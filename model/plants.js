import mongoose from "mongoose";


const plantsSchema = new mongoose.Schema({
        name:        {type: String, required: true},
        description: {type: String, required: true},
        type:        {type: String, required: true},
    },

    {
        toJSON: {
            virtuals: true,
            versionKey: false,
            transform: (doc, ret) => {
                ret._links = {
                    self: {
                        href: `${process.env.BASE_URI}${ret._id}`,
                    },
                    collection: {
                        href: `${process.env.BASE_URI}`,
                    },
                };

                delete ret._id;
               
            },
        },

    }
);

const Plant = mongoose.model("Plant", plantsSchema);

export default Plant;