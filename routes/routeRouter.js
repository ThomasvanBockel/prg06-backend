import express from "express";
import Plant from "../model/plants.js";
import {faker} from "@faker-js/faker/locale/nl";
import mongoose from "mongoose";


const router = express.Router()
router.use((req, res, next) => {
    const acceptHeader = req.headers["accept"];
    const method = req.method

    res.set("Access-Control-Allow-Origin", "*")

    console.log(`Client accepteert: ${acceptHeader}`);
    if (acceptHeader.includes("application/json") || method === "OPTIONS") {
        console.log(`this is JSON`)
        next();
    } else {
        res.status(400).send("Illegal format");
    }
});
router.get("/", async (req, res) => {
    let currentPage = 1
    currentPage = Number(req.query.page)
    if (!currentPage) {
        currentPage = 1
    }
    let amount = await Plant.countDocuments()
    let limit = Number(req.query.limit)
    if (!limit) {
        limit = amount
    }
    let totalPages = Math.ceil(amount / limit) ?? 1
    if (!totalPages) {
        totalPages = 1
    }
    const skip = (currentPage - 1) * limit
    let previousPage = currentPage - 1
    let nextPage = currentPage + 1


    const plants = await Plant.find().limit(limit).skip(skip)

    const items = plants.map((plant) => ({
        id: plant.id,
        name: plant.name,
        type: plant.type ?? "",
        _links: {
            self: {href: `${process.env.BASE_URI}${plant.id}`},
        },
    }));

    const collections = {
        items,
        _links: {
            self: totalPages !== 1 ? {href: `${process.env.BASE_URI}?page=${currentPage}&limit=${limit}`} : {href: `${process.env.BASE_URI}`},
            collection: {href: `${process.env.BASE_URI}`},
        },
        pagination: {
            currentPage: currentPage,
            currentItems: limit,
            totalPages: totalPages,
            totalItems: amount,
            _links: {
                first: totalPages !== 1 ? {
                    page: 1,
                    href: `${process.env.BASE_URI}?page=1&limit=${limit}`
                } : {
                    page: 1,
                    href: `${process.env.BASE_URI}`
                },
                last: totalPages !== 1 ? {
                    page: totalPages,
                    href: `${process.env.BASE_URI}?page=${totalPages}&limit=${limit}`
                } : {
                    page: 1,
                    href: `${process.env.BASE_URI}`
                },
                previous: previousPage > 0 ? {
                    page: previousPage,
                    href: `${process.env.BASE_URI}?page=${previousPage}&limit=${limit}`
                } : null,
                next: currentPage < totalPages && totalPages !== 1 ? {
                    page: nextPage,
                    href: `${process.env.BASE_URI}?page=${nextPage}&limit=${limit}`
                } : null
            }
        }
    }

    res.json(collections)
});

router.options("/", (req, res) => {
    res.header("Allow", "POST, GET, OPTIONS")

    res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS")
    res.setHeader("Access-Control-Allow-Origin", "*")
    res.setHeader("Access-Control-Allow-Headers", "Content-Type, Accept")
    res.status(204).send()
})
router.options(
    "/:id", (req, res) => {
        res.header("Allow", "PUT, GET, OPTIONS, DELETE")

        res.setHeader("Access-Control-Allow-Methods", "GET, PUT, OPTIONS, DELETE")
        res.setHeader("Access-Control-Allow-Origin", "*")
        res.setHeader("Access-Control-Allow-Headers", "Content-Type, Accept")
        res.status(204).send()
    })
// POST overload
router.post("/", async (req, res, next) => {
    try {
        if (req.body?.method && req.body?.method === "SEED") {
            const plants = []
            await Plant.deleteMany({})
            const rawAmount = req.body?.amount ?? 10
            const amount = Math.max(0, Math.min(500, Number(rawAmount) || 10))


            for (let i = 0; i < amount; i++) {
                const plant = Plant({
                    name: faker.lorem.slug(5),
                    description: faker.lorem.text(),
                    type: faker.food.fruit()
                })
                const saved = await plant.save();
                plants.push(saved)
            }

            res.json(plants)
        } else {
            next()
        }
    } catch (e) {
        res.status(500).json({message: "een server error"})
    }
})
// normale POST
router.post("/", async (req, res) => {
    try {
        if (!req.body?.type || !req.body?.description || !req.body?.name) {
            return res.status(400).json({message: "er mist een veld"})
        }
        const plant = new Plant({
            name: req.body.name,
            type: req.body.type,
            description: req.body.description
        })

        await plant.save()
        res.status(201).json(plant)

    } catch (e) {
        console.log(`error ${e}`)
    }
})


router.get("/:id", async (req, res) => {

    try {
        const plantId = req.params.id;

        if (!mongoose.Types.ObjectId.isValid(plantId)) {
            return res.status(404).json({message: "id is niet valid"})
        }

        const plant = await Plant.findById(plantId);
        const modifiedDate = req.headers["if-modified-since"];
        let lastModified = plant.updatedAt;

        if (plant == null) {
            return res.status(404).json({message: "plant bestaat niet"})
        }


        if (!(lastModified instanceof Date)) {
            lastModified = plant._id.getTimestamp();
        }

        res.set("Last-Modified", lastModified.toUTCString());

        if (modifiedDate && new Date(modifiedDate) >= lastModified) {
            return res.status(304).send();
        }

        res.header("h")

        res.status(200).json(plant)
    } catch (e) {
        res.status(404).send()
    }
})

router.delete("/:id", async (req, res) => {
    try {
        const plantId = req.params.id

        if (!mongoose.Types.ObjectId.isValid(plantId)) {
            return res.status(400).json({message: "id is niet valid"});
        }
        const deleted = await Plant.findByIdAndDelete(plantId)

        if (!deleted) {
            return res.status(404).json({message: "plant is niet gevonden"})
        }
        res.status(204).send()
    } catch (e) {
        res.status(500).json({message: "gefaald om te verwijderen"})
    }

})

router.patch("/:id", async (req, res) => {
    try {
        const plantId = req.params.id

        const {description, name, type} = req.body ?? null

        if (!name && !description && !type) {
            return res.status(400).json({
                message: "de velden moeten verplicht ingevoerd worden",
            })
        }
        const updated = await Plant.findByIdAndUpdate(
            plantId,
            {...(name && {name}), ...(description && {description}), ...(type && {type})},
            {new: true, runValidators: true}
        );
        if (!updated) {
            return res.status(404).json({message: "de plant is niet gevonden"})
        }
        res.status(200).json(updated)
    } catch (e) {
        res.status(500)
    }
})
router.put("/:id", async (req, res) => {
    try {
        const plantId = req.params.id

        if (!mongoose.Types.ObjectId.isValid(plantId)) {
            return res.status(400).json({message: "id is niet valid"})
        }

        const {name, description, type} = req.body ?? {}

        if (!name && !description && !type) {
            return res.status(400).json({
                message: "de velden moeten verplicht ingevoerd worden",
            })
        }

        const updated = await Plant.findByIdAndUpdate(
            plantId,
            {...(name && {name}), ...(description && {description}), ...(type && {type})},
            {new: true, runValidators: true}
        );

        if (!updated) {
            return res.status(404).json({message: "de plant is niet gevonden"})
        }

        res.status(200).json(updated)
    } catch (e) {
        if (e?.name === "ValidationError") {
            return res.status(400).json({message: e.message})
        }
        res.status(500).json({message: "gefaald om de plant te updaten"})
    }
})

export default router