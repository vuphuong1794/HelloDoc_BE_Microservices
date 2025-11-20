export default () => ({
    jwt: {
        secret: process.env.JWT_SECRET,
    },
    database: {
        connectionString: process.env.MONGO_URL
    },
    cloudinary: {
        cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
        api_key: process.env.CLOUDINARY_API_KEY,
        api_secret: process.env.CLOUDINARY_API_SECRET,
    }
});