import cors from "cors";
import express from "express";
import path from "path";
import "reflect-metadata";
import { errorMiddleware } from "./API/errorMiddleware";
import appointmentRoutes from "./API/Routes/AppointmentRoutes";
import barberRoutes from "./API/Routes/BarberRoutes";
import userRoutes from "./API/Routes/UserRoutes";
import {
    createDatabaseIfNotExists,
    AppDataSource,
} from "./Infra/Database/DataSource";
import { debugMiddleware } from "./API/debugMiddleware";
import timeSlotRoutes from "./API/Routes/TimeSlotRoutes";
export const app = express();
const PORT = 3000;

const isDevelopment = process.env.NODE_ENV === "development";
const isTest = process.env.NODE_ENV === "test";

app.use(
    cors({
        // During development, allow requests from the frontend dev server
        origin: isDevelopment ? "*" : "*", // Assuming React app runs on 5173 (Vite default)
        credentials: true,
    })
);

app.use(express.json());

app.use(debugMiddleware);
// Routers
app.use("/api/users", userRoutes);
app.use("/api/barbers", barberRoutes);
app.use("/api/appointments", appointmentRoutes);
app.use("/api/timeslots", timeSlotRoutes);

if (isTest) {
    app.post("/test/error", (_req, _res, next) => {
        next(new Error("Simulated database error"));
    });
}

app.use(errorMiddleware);

// Start app after DB connection
createDatabaseIfNotExists()
    .then(() => {
        return AppDataSource.initialize();
    })
    .then(() => {
        console.log("Database connected.");
        // Serve React static build (assuming /frontend/dist or /frontend/build)
        const __dirname = path.resolve();
        app.use(express.static(path.join(__dirname, "../Frontend/dist")));
        // Handle React routing (for React Router etc.)
        app.get("/", (_req, res) => {
            res.sendFile(
                path.join(__dirname, "../Frontend/dist", "index.html")
            );
        });
        app.listen(PORT, () => {
            console.log(`Server running on port ${PORT}`);
        });
    })
    .catch((error) => console.error("DB connection error:", error));
