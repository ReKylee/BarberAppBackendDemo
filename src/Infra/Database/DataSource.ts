import dotenv from "dotenv";
import { createConnection, Connection } from "mysql2/promise";
import { DataSource } from "typeorm";
import { AppointmentORM } from "../ORM/AppointmentORM";
import { BarberORM } from "../ORM/BarberORM";
import { UserORM } from "../ORM/UserORM";
import { TimeSlotORM } from "../ORM/TimeSlotORM";

dotenv.config();
const isDevelopment = process.env.NODE_ENV === "development";
const isTesting = process.env.NODE_ENV === "test";

export const AppDataSource = new DataSource({
    type: "mysql",
    host: process.env.DB_HOST,
    port: Number(process.env.DB_PORT),
    username: process.env.DB_USER,
    password: process.env.DB_PASS,
    database: process.env.DB_NAME,
    logging: true,
    entities: [UserORM, BarberORM, AppointmentORM, TimeSlotORM],
    synchronize: isDevelopment || isTesting,
});

export async function createDatabaseIfNotExists(): Promise<void> {
    let connection: Connection | undefined;
    try {
        connection = await createConnection({
            host: process.env.DB_HOST,
            port: Number(process.env.DB_PORT),
            user: process.env.DB_USER,
            password: process.env.DB_PASS,
        });
        // Create database if it doesn't exist
        await connection.query(
            `CREATE DATABASE IF NOT EXISTS \`${process.env.DB_NAME}\``
        );
        console.log(
            `Database '${process.env.DB_NAME}' created or already exists`
        );
    } catch (error) {
        console.error("Error creating database:", error);
        throw error;
    } finally {
        if (connection) {
            try {
                await connection.end();
                console.log("Database connection closed successfully.");
            } catch (endError) {
                console.error("Error closing database connection:", endError);
            }
        }
    }
}
