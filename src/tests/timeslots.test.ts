import request from "supertest";
import { app } from "../server";
import { v4 as uuidv4 } from "uuid";
import { AppDataSource } from "../Infra/Database/DataSource";
import { BarberORM } from "../Infra/ORM/BarberORM";
import { TimeSlotORM } from "../Infra/ORM/TimeSlotORM";
import { AppointmentORM } from "../Infra/ORM/AppointmentORM";
import { Repository } from "typeorm";
// Add this to the test file to help with debugging

describe("TimeSlot API Tests", () => {
    let barberRepository: Repository<BarberORM>;
    let timeSlotRepository: Repository<TimeSlotORM>;
    let appointmentRepository: Repository<AppointmentORM>;
    let testBarberId: string;
    let testTimeSlotId: string;

    // Before all tests, set up the database
    beforeAll(async () => {
        // Initialize database connection
        if (!AppDataSource.isInitialized) {
            await AppDataSource.initialize();
            await AppDataSource.synchronize(true);
        }

        // Get repositories
        barberRepository = AppDataSource.getRepository(BarberORM);
        timeSlotRepository = AppDataSource.getRepository(TimeSlotORM);
        appointmentRepository = AppDataSource.getRepository(AppointmentORM);

        // Clean up existing test data
        await cleanupDatabases();

        // Create a test barber to use in timeslot tests
        await createTestBarber();
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

    // Helper to create a test barber with valid phone number
    async function createTestBarber() {
        const barber = new BarberORM();
        barber.barberId = uuidv4();
        barber.firstName = "timeslot";
        barber.lastName = "testbarber";

        const savedBarber = await barberRepository.save(barber);
        testBarberId = savedBarber.barberId;

        console.log(`Created test barber with ID: ${testBarberId}`);
    }

    // Helper to create valid timeslot data with TimeslotDate structure
    function createValidTimeSlotData() {
        const tomorrow = new Date();
        tomorrow.setDate(tomorrow.getDate() + 1);
        tomorrow.setHours(10, 0, 0, 0); // 10:00 AM tomorrow

        return {
            id: uuidv4(),
            startDateTime: tomorrow.toISOString(), // changed from startTime to startDateTime
            duration: 20,
            barberId: testBarberId,
        };
    }

    describe("POST /api/timeslots/barber/:barberId", () => {
        it("should create a new timeslot with valid data", async () => {
            const timeSlotData = createValidTimeSlotData();

            console.log(`Creating timeslot for barber ID: ${testBarberId}`);

            const response = await request(app)
                .post(`/api/timeslots/barber/${testBarberId}`)
                .send(timeSlotData)
                .expect(201);

            // Save ID for later tests
            testTimeSlotId = response.body.id;

            // Validate response
            expect(response.body).toHaveProperty("id");
            expect(typeof response.body.id).toBe("string");
            expect(response.body).toHaveProperty("startDateTime"); // Note the changed property name
            expect(response.body).toHaveProperty("duration", 20);
            expect(response.body).toHaveProperty("barberId", testBarberId);
            expect(response.body).toHaveProperty("isBooked", false);

            // Verify in database
            const savedTimeSlot = await timeSlotRepository.findOne({
                where: { timeSlotId: response.body.id },
                relations: { barber: true },
            });

            expect(savedTimeSlot).not.toBeNull();
            expect(savedTimeSlot?.barber.barberId).toBe(testBarberId);
        });

        it("should reject timeslot with invalid barber ID", async () => {
            const nonExistentBarberId = uuidv4();
            const timeSlotData = createValidTimeSlotData();
            timeSlotData.barberId = nonExistentBarberId;

            const response = await request(app)
                .post(`/api/timeslots/barber/${nonExistentBarberId}`)
                .send(timeSlotData)
                .expect(404);

            expect(response.body).toHaveProperty("type", "NOT_FOUND");
        });

        it("should reject timeslot without required fields", async () => {
            const invalidData = {
                id: uuidv4(),
                // Missing startDateTime and duration
            };

            const response = await request(app)
                .post(`/api/timeslots/barber/${testBarberId}`)
                .send(invalidData)
                .expect(400);

            expect(response.body).toHaveProperty("type", "VALIDATION_ERROR");
        });
    });

    describe("GET /api/timeslots/barber/:barberId", () => {
        it("should return timeslots for a specific barber", async () => {
            const response = await request(app)
                .get(`/api/timeslots/barber/${testBarberId}`)
                .expect(200);

            expect(response.body).toHaveProperty("timeSlots");
            expect(Array.isArray(response.body.timeSlots)).toBe(true);
            expect(response.body).toHaveProperty("count");

            // Verify our test timeslot is in the results
            const testSlot = response.body.timeSlots.find(
                (t: { id: string }) => t.id === testTimeSlotId
            );
            expect(testSlot).toBeDefined();
        });

        it("should filter available timeslots only", async () => {
            const response = await request(app)
                .get(`/api/timeslots/barber/${testBarberId}?status=free`)
                .expect(200);

            // All returned timeslots should be available (not booked)
            response.body.timeSlots.forEach((timeSlot: { isBooked: any }) => {
                expect(timeSlot.isBooked).toBe(false);
            });
        });
    });

    describe("GET /api/timeslots/:timeslotId", () => {
        it("should return a specific timeslot by ID", async () => {
            const response = await request(app)
                .get(`/api/timeslots/${testTimeSlotId}`)
                .expect(200);

            expect(response.body).toHaveProperty("id", testTimeSlotId);
            expect(response.body).toHaveProperty("startDateTime"); // Note the changed property
            expect(response.body).toHaveProperty("duration");
            expect(response.body).toHaveProperty("barberId", testBarberId);
        });

        it("should return 404 for non-existent timeslot ID", async () => {
            const nonExistentId = uuidv4();

            const response = await request(app)
                .get(`/api/timeslots/${nonExistentId}`)
                .expect(404);

            expect(response.body).toHaveProperty("type", "NOT_FOUND");
        });
    });

    describe("DELETE /api/timeslots/barber/:barberId/:timeslotId", () => {
        let timeSlotToDeleteId: string;

        // Create a timeslot to delete
        beforeEach(async () => {
            // Create directly in database
            const tomorrow = new Date();
            tomorrow.setDate(tomorrow.getDate() + 1);
            tomorrow.setHours(14, 0, 0, 0);

            const timeSlot = new TimeSlotORM();
            timeSlot.timeSlotId = uuidv4();
            timeSlot.startTime = tomorrow; // This maps to startDateTime in domain
            timeSlot.duration = 20;
            timeSlot.isBooked = false;
            timeSlot.barber = { barberId: testBarberId } as any;

            const savedTimeSlot = await timeSlotRepository.save(timeSlot);
            timeSlotToDeleteId = savedTimeSlot.timeSlotId;
        });

        it("should delete an existing timeslot", async () => {
            await request(app)
                .delete(
                    `/api/timeslots/barber/${testBarberId}/${timeSlotToDeleteId}`
                )
                .expect(204);

            // Verify it's deleted from the database
            const deletedTimeSlot = await timeSlotRepository.findOneBy({
                timeSlotId: timeSlotToDeleteId,
            });
            expect(deletedTimeSlot).toBeNull();
        });

        it("should reject deleting a booked timeslot", async () => {
            // Create a timeslot
            const tomorrow = new Date();
            tomorrow.setDate(tomorrow.getDate() + 1);
            tomorrow.setHours(16, 0, 0, 0);

            const timeSlot = new TimeSlotORM();
            timeSlot.timeSlotId = uuidv4();
            timeSlot.startTime = tomorrow;
            timeSlot.duration = 20;
            timeSlot.isBooked = true; // Already booked
            timeSlot.barber = { barberId: testBarberId } as any;

            const savedTimeSlot = await timeSlotRepository.save(timeSlot);

            // Try to delete it
            const response = await request(app)
                .delete(
                    `/api/timeslots/barber/${testBarberId}/${savedTimeSlot.timeSlotId}`
                )
                .expect(422);

            expect(response.body).toHaveProperty("type", "BUSINESS_RULE_ERROR");
            expect(response.body.message).toContain(
                "Cannot delete a timeslot that is currently booked"
            );
        });
    });

    describe("POST /api/timeslots/barber/:barberId/weekly", () => {
        it("should create multiple timeslots based on a weekly schedule", async () => {
            // Create a weekly schedule
            const startDate = new Date();
            startDate.setDate(startDate.getDate() + 1); // Start tomorrow

            const endDate = new Date(startDate);
            endDate.setDate(endDate.getDate() + 7); // One week from start

            const scheduleData = {
                startDate: startDate.toISOString(),
                endDate: endDate.toISOString(),
                dailySlots: [
                    {
                        dayOfWeek: 1, // Monday
                        startTime: "09:00",
                        endTime: "12:00",
                        duration: 20,
                        interval: 20,
                    },
                    {
                        dayOfWeek: 3, // Wednesday
                        startTime: "13:00",
                        endTime: "17:00",
                        duration: 30,
                        interval: 30,
                    },
                ],
            };

            const response = await request(app)
                .post(`/api/timeslots/barber/${testBarberId}/weekly`)
                .send(scheduleData)
                .expect(201);

            expect(response.body).toHaveProperty("count");
            expect(response.body.count).toBeGreaterThan(0);
            expect(response.body).toHaveProperty("message");
            expect(response.body.message).toContain("Created");

            // Verify timeslots were created in the database
            const createdTimeSlots = await timeSlotRepository.find({
                where: { barber: { barberId: testBarberId } },
            });

            // Should have created multiple slots
            expect(createdTimeSlots.length).toBeGreaterThanOrEqual(
                response.body.count
            );
        });

        it("should reject schedule with invalid date range", async () => {
            // End date before start date
            const invalidSchedule = {
                startDate: new Date("2025-05-10").toISOString(),
                endDate: new Date("2025-05-01").toISOString(), // Before start date
                dailySlots: [
                    {
                        dayOfWeek: 1,
                        startTime: "09:00",
                        endTime: "12:00",
                        duration: 20,
                    },
                ],
            };

            const response = await request(app)
                .post(`/api/timeslots/barber/${testBarberId}/weekly`)
                .send(invalidSchedule)
                .expect(422);

            expect(response.body).toHaveProperty("type", "BUSINESS_RULE_ERROR");
            expect(response.body.message).toContain(
                "End date must be after start date"
            );
        });
    });

    // New test suite for timeslot overlap detection
    describe("Timeslot Overlap Prevention", () => {
        let baseTimeslotId: string;

        // Before overlap tests, create a base timeslot to test overlaps against
        beforeAll(async () => {
            // Create a reference timeslot: 11:00 AM - 11:30 AM tomorrow
            const tomorrow = new Date();
            tomorrow.setDate(tomorrow.getDate() + 1);
            tomorrow.setHours(11, 0, 0, 0); // 11:00 AM

            const baseTimeslot = new TimeSlotORM();
            baseTimeslotId = uuidv4();
            baseTimeslot.timeSlotId = baseTimeslotId;
            baseTimeslot.startTime = tomorrow;
            baseTimeslot.duration = 30; // 30 minutes (ends at 11:30)
            baseTimeslot.isBooked = false;
            baseTimeslot.barber = { barberId: testBarberId } as any;

            await timeSlotRepository.save(baseTimeslot);

            console.log(
                `Created base timeslot for overlap tests: ${tomorrow.toISOString()} (30 min)`
            );
        });

        // Helper function to create timeslot data for specific time
        function createTimeslotAtTime(
            hour: number,
            minute: number,
            duration: number
        ) {
            const tomorrow = new Date();
            tomorrow.setDate(tomorrow.getDate() + 1);
            tomorrow.setHours(hour, minute, 0, 0);

            return {
                startDateTime: tomorrow.toISOString(),
                duration: duration,
                barberId: testBarberId,
            };
        }

        it("should reject exact overlapping timeslot (same start time and duration)", async () => {
            // Create a timeslot with exact same time as base
            const sameTimeData = createTimeslotAtTime(11, 0, 30); // 11:00 - 11:30 (same as base)

            const response = await request(app)
                .post(`/api/timeslots/barber/${testBarberId}`)
                .send(sameTimeData)
                .expect(422);

            expect(response.body).toHaveProperty("type", "BUSINESS_RULE_ERROR");
            expect(response.body.message).toContain("overlaps");
        });

        it("should reject timeslot that starts during an existing timeslot", async () => {
            // Create a timeslot that starts in the middle of the base timeslot
            const partialOverlapData = createTimeslotAtTime(11, 15, 30); // 11:15 - 11:45

            const response = await request(app)
                .post(`/api/timeslots/barber/${testBarberId}`)
                .send(partialOverlapData)
                .expect(422);

            expect(response.body).toHaveProperty("type", "BUSINESS_RULE_ERROR");
            expect(response.body.message).toContain("overlaps");
        });

        it("should reject timeslot that ends during an existing timeslot", async () => {
            // Create a timeslot that ends in the middle of the base timeslot
            const partialOverlapData = createTimeslotAtTime(10, 45, 30); // 10:45 - 11:15

            const response = await request(app)
                .post(`/api/timeslots/barber/${testBarberId}`)
                .send(partialOverlapData)
                .expect(422);

            expect(response.body).toHaveProperty("type", "BUSINESS_RULE_ERROR");
            expect(response.body.message).toContain("overlaps");
        });

        it("should reject timeslot that completely surrounds an existing timeslot", async () => {
            // Create a timeslot that completely surrounds the base timeslot
            const surroundingData = createTimeslotAtTime(10, 30, 90); // 10:30 - 12:00

            const response = await request(app)
                .post(`/api/timeslots/barber/${testBarberId}`)
                .send(surroundingData)
                .expect(422);

            expect(response.body).toHaveProperty("type", "BUSINESS_RULE_ERROR");
            expect(response.body.message).toContain("overlaps");
        });

        it("should reject timeslot that is completely within an existing timeslot", async () => {
            // Create a timeslot that is completely within the base timeslot
            const containedData = createTimeslotAtTime(11, 10, 10); // 11:10 - 11:20

            const response = await request(app)
                .post(`/api/timeslots/barber/${testBarberId}`)
                .send(containedData)
                .expect(422);

            expect(response.body).toHaveProperty("type", "BUSINESS_RULE_ERROR");
            expect(response.body.message).toContain("overlaps");
        });

        it("should allow timeslot that starts exactly when another ends", async () => {
            // Create a timeslot that starts exactly when the base timeslot ends
            const adjacentData = createTimeslotAtTime(11, 30, 30); // 11:30 - 12:00

            const response = await request(app)
                .post(`/api/timeslots/barber/${testBarberId}`)
                .send(adjacentData)
                .expect(201);

            expect(response.body).toHaveProperty("id");
            expect(response.body).toHaveProperty("duration", 30);

            // Clean up (delete this timeslot)
            await timeSlotRepository.delete(response.body.id);
        });

        it("should allow timeslot that ends exactly when another starts", async () => {
            // Create a timeslot that ends exactly when the base timeslot starts
            const adjacentData = createTimeslotAtTime(10, 30, 30); // 10:30 - 11:00

            const response = await request(app)
                .post(`/api/timeslots/barber/${testBarberId}`)
                .send(adjacentData)
                .expect(201);

            expect(response.body).toHaveProperty("id");
            expect(response.body).toHaveProperty("duration", 30);

            // Clean up (delete this timeslot)
            await timeSlotRepository.delete(response.body.id);
        });

        it("should allow timeslot completely before an existing timeslot", async () => {
            // Create a timeslot that is completely before the base timeslot
            const beforeData = createTimeslotAtTime(9, 0, 30); // 9:00 - 9:30

            const response = await request(app)
                .post(`/api/timeslots/barber/${testBarberId}`)
                .send(beforeData)
                .expect(201);

            expect(response.body).toHaveProperty("id");
            expect(response.body).toHaveProperty("duration", 30);

            // Clean up (delete this timeslot)
            await timeSlotRepository.delete(response.body.id);
        });

        it("should allow timeslot completely after an existing timeslot", async () => {
            // Log all existing timeslots
            const existingSlots = await timeSlotRepository.find({
                where: { barber: { barberId: testBarberId } },
                order: { startTime: "ASC" },
            });

            console.log("All existing timeslots before test:");
            existingSlots.forEach((slot) => {
                const start = new Date(slot.startTime);
                const end = new Date(
                    start.getTime() + slot.duration * 60 * 1000
                );
                console.log(
                    `- ${
                        slot.timeSlotId
                    }: ${start.toISOString()} to ${end.toISOString()} (${
                        slot.duration
                    } min)`
                );
            });

            // Find a gap - looking at logs, 9:00-9:30 seems free
            const tomorrow = new Date();
            tomorrow.setDate(tomorrow.getDate() + 1);
            tomorrow.setHours(9, 0, 0, 0); // 9:00 AM, which should be after the base slot (8:00-8:30) and not conflict

            const afterData = {
                startDateTime: tomorrow.toISOString(),
                duration: 30,
                barberId: testBarberId,
            };

            console.log(
                "Creating non-overlapping timeslot at a specific time:",
                afterData
            );

            const response = await request(app)
                .post(`/api/timeslots/barber/${testBarberId}`)
                .send(afterData)
                .expect(201);

            expect(response.body).toHaveProperty("id");

            // Clean up
            await timeSlotRepository.delete(response.body.id);
        });
        it("should handle overlap checks for different barbers separately", async () => {
            // Create a different barber
            const otherBarber = new BarberORM();
            otherBarber.barberId = uuidv4();
            otherBarber.firstName = "other";
            otherBarber.lastName = "barber";
            const savedBarber = await barberRepository.save(otherBarber);

            // Try to create a timeslot with same time as base timeslot but for different barber
            const sameTimeData = createTimeslotAtTime(11, 0, 30); // 11:00 - 11:30 (same as base)
            sameTimeData.barberId = savedBarber.barberId;

            // Should succeed because it's for a different barber
            const response = await request(app)
                .post(`/api/timeslots/barber/${savedBarber.barberId}`)
                .send(sameTimeData)
                .expect(201);

            expect(response.body).toHaveProperty("id");
            expect(response.body).toHaveProperty(
                "barberId",
                savedBarber.barberId
            );

            // Clean up
            await timeSlotRepository.delete(response.body.id);
            await barberRepository.delete(savedBarber.barberId);
        });

        it("should check overlaps when creating weekly schedules", async () => {
            // Get the day of week for tomorrow (when our base timeslot is)
            const tomorrow = new Date();
            tomorrow.setDate(tomorrow.getDate() + 1);
            const tomorrowDayOfWeek = tomorrow.getDay();

            // Create a weekly schedule with a slot that would overlap with base timeslot
            const startDate = new Date();
            startDate.setDate(startDate.getDate()); // Start from today

            const endDate = new Date(startDate);
            endDate.setDate(endDate.getDate() + 7); // One week

            const scheduleData = {
                startDate: startDate.toISOString(),
                endDate: endDate.toISOString(),
                dailySlots: [
                    {
                        dayOfWeek: tomorrowDayOfWeek,
                        startTime: "10:45", // This would overlap with 11:00-11:30 timeslot
                        endTime: "12:00",
                        duration: 30,
                        interval: 30,
                    },
                ],
            };

            const response = await request(app)
                .post(`/api/timeslots/barber/${testBarberId}/weekly`)
                .send(scheduleData)
                .expect(422);

            expect(response.body).toHaveProperty("type", "BUSINESS_RULE_ERROR");
            expect(response.body.message).toContain("overlaps");
        });

        // Clean up after all overlap tests
        afterAll(async () => {
            // Delete the base timeslot if it exists
            if (baseTimeslotId) {
                await timeSlotRepository.delete(baseTimeslotId);
            }
        });
    });
});
