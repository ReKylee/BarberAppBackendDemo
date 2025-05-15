import request from "supertest";
import { app } from "../server";
import { v4 as uuidv4 } from "uuid";
import { AppDataSource } from "../Infra/Database/DataSource";
import { BarberORM } from "../Infra/ORM/BarberORM";
import { TimeSlotORM } from "../Infra/ORM/TimeSlotORM";
import { AppointmentORM } from "../Infra/ORM/AppointmentORM";
import { Repository } from "typeorm";

describe("Barber API Tests", () => {
    let barberRepository: Repository<BarberORM>;
    let timeSlotRepository: Repository<TimeSlotORM>;
    let appointmentRepository: Repository<AppointmentORM>;
    let testBarberId: string;

    // Before all tests, set up the database
    beforeAll(async () => {
        // Initialize database connection
        if (!AppDataSource.isInitialized) {
            await AppDataSource.initialize();
        }

        // Get repositories
        barberRepository = AppDataSource.getRepository(BarberORM);
        timeSlotRepository = AppDataSource.getRepository(TimeSlotORM);
        appointmentRepository = AppDataSource.getRepository(AppointmentORM);

        // Clean up existing test data
        await cleanupDatabases();
    });

    // After all tests, clean up
    afterAll(async () => {
        // Clean up test data
        await cleanupDatabases();

        // Close database connection
        if (AppDataSource.isInitialized) {
            await AppDataSource.destroy();
        }
    });

    // Helper function to clean up test data
    async function cleanupDatabases() {
        try {
            // Delete in correct order to respect foreign key constraints
            await appointmentRepository.query("DELETE FROM appointment_orm");
            await timeSlotRepository.query("DELETE FROM time_slot_orm");
            await barberRepository.query("DELETE FROM barber_orm");
        } catch (error) {
            console.error("Error cleaning up databases:", error);
        }
    }

    // Helper to generate a unique barber name
    function generateUniqueBarberName() {
        const timestamp = Date.now();
        const random = Math.floor(Math.random() * 10000);
        return {
            firstName: `Test${timestamp}`,
            lastName: `Barber${random}`,
        };
    }

    describe("POST /api/barbers", () => {
        it("should create a new barber with valid data", async () => {
            // Create unique barber data
            const barberData = generateUniqueBarberName();

            // Send request
            const response = await request(app)
                .post("/api/barbers")
                .send(barberData)
                .expect(201);

            // Save ID for later tests
            testBarberId = response.body.id;

            // Validate response
            expect(response.body).toHaveProperty("id");
            expect(typeof response.body.id).toBe("string");
            expect(response.body.firstName).toBe(
                barberData.firstName.toLowerCase()
            );
            expect(response.body.lastName).toBe(
                barberData.lastName.toLowerCase()
            );

            // Verify in database
            const savedBarber = await barberRepository.findOneBy({
                barberId: response.body.id,
            });
            expect(savedBarber).not.toBeNull();
            expect(savedBarber?.firstName).toBe(
                barberData.firstName.toLowerCase()
            );
        });

        it("should reject creating a barber with duplicate name", async () => {
            // Get an existing barber
            const existingBarber = await barberRepository.findOneBy({
                barberId: testBarberId,
            });
            if (!existingBarber) {
                throw new Error("Test setup failed: No existing barber found");
            }

            // Try to create a barber with the same name
            const duplicateData = {
                firstName: existingBarber.firstName,
                lastName: existingBarber.lastName,
            };

            const response = await request(app)
                .post("/api/barbers")
                .send(duplicateData)
                .expect(400);

            // Validate error response
            expect(response.body).toHaveProperty("type", "VALIDATION_ERROR");
            expect(response.body.message).toContain("Validation failed");
        });

        it("should reject a barber with missing required fields", async () => {
            const invalidData = {
                // Missing lastName
                firstName: "OnlyFirst",
            };

            const response = await request(app)
                .post("/api/barbers")
                .send(invalidData)
                .expect(400);

            expect(response.body).toHaveProperty("type", "VALIDATION_ERROR");
        });
    });

    describe("GET /api/barbers", () => {
        it("should return a list of barbers", async () => {
            const response = await request(app).get("/api/barbers").expect(200);

            expect(response.body).toHaveProperty("barbers");
            expect(Array.isArray(response.body.barbers)).toBe(true);
            expect(response.body).toHaveProperty("count");
            expect(typeof response.body.count).toBe("number");

            // Verify our test barber is in the list
            const testBarber = response.body.barbers.find(
                (b: { id: string }) => b.id === testBarberId
            );
            expect(testBarber).toBeDefined();
        });
    });

    describe("GET /api/barbers/:barberId", () => {
        it("should return a specific barber by ID", async () => {
            const response = await request(app)
                .get(`/api/barbers/${testBarberId}`)
                .expect(200);

            expect(response.body).toHaveProperty("id", testBarberId);
            expect(response.body).toHaveProperty("firstName");
            expect(response.body).toHaveProperty("lastName");
        });

        it("should return 404 for non-existent barber ID", async () => {
            const nonExistentId = uuidv4();

            const response = await request(app)
                .get(`/api/barbers/${nonExistentId}`)
                .expect(404);

            expect(response.body).toHaveProperty("type", "NOT_FOUND");
        });

        it("should return 400 for invalid UUID format", async () => {
            const response = await request(app)
                .get("/api/barbers/not-a-uuid")
                .expect(400);

            expect(response.body).toHaveProperty("type", "VALIDATION_ERROR");
        });
    });

    describe("GET /api/barbers/search", () => {
        it("should find a barber by name", async () => {
            // Get an existing barber
            const existingBarber = await barberRepository.findOneBy({
                barberId: testBarberId,
            });
            if (!existingBarber) {
                throw new Error("Test setup failed: No existing barber found");
            }

            const response = await request(app)
                .get(
                    `/api/barbers/search?firstName=${existingBarber.firstName}&lastName=${existingBarber.lastName}`
                )
                .expect(200);

            expect(response.body).toHaveProperty("id", testBarberId);
            expect(response.body.firstName).toBe(existingBarber.firstName);
            expect(response.body.lastName).toBe(existingBarber.lastName);
        });

        it("should return 404 for non-existent barber name", async () => {
            const response = await request(app)
                .get(
                    "/api/barbers/search?firstName=NonExistent&lastName=Barber"
                )
                .expect(404);

            expect(response.body).toHaveProperty("type", "NOT_FOUND");
        });
    });
});
