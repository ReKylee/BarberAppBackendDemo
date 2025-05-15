import request from "supertest";
import { app } from "../server";
import { AppDataSource } from "../Infra/Database/DataSource";
import { TimeSlotORM } from "../Infra/ORM/TimeSlotORM";
import { BarberORM } from "../Infra/ORM/BarberORM";
import { Repository } from "typeorm";
import { v4 as uuidv4 } from "uuid";

describe("Weekly Schedule API Endpoint Tests", () => {
    let barberRepository: Repository<BarberORM>;
    let timeSlotRepository: Repository<TimeSlotORM>;
    let testBarberId: string;

    beforeAll(async () => {
        // Initialize database connection
        if (!AppDataSource.isInitialized) {
            await AppDataSource.initialize();
            await AppDataSource.synchronize(true);
        }

        barberRepository = AppDataSource.getRepository(BarberORM);
        timeSlotRepository = AppDataSource.getRepository(TimeSlotORM);

        // Clean up existing test data
        await cleanupTestData();

        // Create a test barber
        const barber = new BarberORM();
        barber.barberId = uuidv4();
        barber.firstName = "endpoint";
        barber.lastName = "tester";
        await barberRepository.save(barber);
        testBarberId = barber.barberId;

        console.log(`Created test barber with ID: ${testBarberId}`);
    });

    afterAll(async () => {
        // Clean up test data
        await cleanupTestData();

        if (AppDataSource.isInitialized) {
            await AppDataSource.destroy();
        }
    });

    // Helper function to clean up test data
    async function cleanupTestData() {
        try {
            // Use raw SQL for direct deletion - safer for cleanup
            await timeSlotRepository.query(
                "DELETE FROM time_slot_orm WHERE barberId = ?",
                [testBarberId]
            );

            await barberRepository.delete(testBarberId);
        } catch (error) {
            console.error("Error cleaning up test data:", error);
        }
    }

    // Helper to clear all time slots between tests
    beforeEach(async () => {
        // Use raw SQL for cleanup
        await timeSlotRepository.query(
            "DELETE FROM time_slot_orm WHERE barberId = ?",
            [testBarberId]
        );
    });

    describe("POST /api/timeslots/barber/:barberId/weekly", () => {
        it("should create a weekly schedule successfully", async () => {
            // Create a basic weekly schedule
            const today = new Date();
            const oneWeekAhead = new Date(today);
            oneWeekAhead.setDate(oneWeekAhead.getDate() + 7);

            const scheduleData = {
                startDate: today.toISOString(),
                endDate: oneWeekAhead.toISOString(),
                dailySlots: [
                    {
                        dayOfWeek: 1, // Monday
                        startTime: "09:00",
                        endTime: "12:00",
                        duration: 30,
                        interval: 30,
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

            // Verify response
            expect(response.body).toHaveProperty("count");
            expect(response.body).toHaveProperty("message");
            expect(response.body.count).toBeGreaterThan(0);
            expect(response.body.message).toContain(
                `Created ${response.body.count} time slots for barber`
            );

            // Verify slots were created in the database - use a JOIN query
            const createdSlots = await timeSlotRepository.find({
                relations: { barber: true },
                where: { barber: { barberId: testBarberId } },
            });

            expect(createdSlots.length).toBe(response.body.count);

            // Verify slot properties
            const mondaySlots = createdSlots.filter((slot) => {
                const date = new Date(slot.startTime);
                return date.getDay() === 1; // Monday
            });

            const wednesdaySlots = createdSlots.filter((slot) => {
                const date = new Date(slot.startTime);
                return date.getDay() === 3; // Wednesday
            });

            // Check if we have both Monday and Wednesday slots
            // Note: This could be 0 if there's no Monday/Wednesday in the date range
            expect(mondaySlots.length + wednesdaySlots.length).toBeGreaterThan(
                0
            );

            // For each slot, check properties
            for (const slot of createdSlots) {
                expect(slot.barber.barberId).toBe(testBarberId);
                expect(slot.duration).toBe(30);
                expect(slot.isBooked).toBe(false);
            }
        });

        it("should return 400 with invalid schedule data", async () => {
            // Create a schedule with invalid date range (end before start)
            const today = new Date();
            const yesterday = new Date(today);
            yesterday.setDate(yesterday.getDate() - 1);

            const invalidScheduleData = {
                startDate: today.toISOString(),
                endDate: yesterday.toISOString(), // End date before start date
                dailySlots: [
                    {
                        dayOfWeek: 1,
                        startTime: "09:00",
                        endTime: "12:00",
                        duration: 30,
                    },
                ],
            };

            const response = await request(app)
                .post(`/api/timeslots/barber/${testBarberId}/weekly`)
                .send(invalidScheduleData)
                .expect(422); // Unprocessable Entity for business rule errors

            // Verify error response
            expect(response.body).toHaveProperty("type", "BUSINESS_RULE_ERROR");
            expect(response.body).toHaveProperty(
                "message",
                "End date must be after start date"
            );

            // Verify no slots were created
            const createdSlots = await timeSlotRepository.find({
                relations: { barber: true },
                where: { barber: { barberId: testBarberId } },
            });
            expect(createdSlots.length).toBe(0);
        });

        it("should return 404 with non-existent barber ID", async () => {
            const nonExistentBarberId = uuidv4(); // Random non-existent ID

            const scheduleData = {
                startDate: new Date().toISOString(),
                endDate: new Date(
                    Date.now() + 7 * 24 * 60 * 60 * 1000
                ).toISOString(), // One week ahead
                dailySlots: [
                    {
                        dayOfWeek: 1,
                        startTime: "09:00",
                        endTime: "12:00",
                        duration: 30,
                    },
                ],
            };

            const response = await request(app)
                .post(`/api/timeslots/barber/${nonExistentBarberId}/weekly`)
                .send(scheduleData)
                .expect(404);

            // Verify error response
            expect(response.body).toHaveProperty("type", "NOT_FOUND");
            expect(response.body.message).toContain("not found");
        });

        it("should return 422 when creating overlapping timeslots", async () => {
            // First create an existing timeslot
            const nextMonday = getNextDayOfWeek(new Date(), 1); // Next Monday
            nextMonday.setHours(10, 0, 0, 0); // 10:00 AM

            // First, get the barber entity
            const barber = await barberRepository.findOneByOrFail({
                barberId: testBarberId,
            });

            const existingSlot = new TimeSlotORM();
            existingSlot.timeSlotId = uuidv4();
            existingSlot.barber = barber;
            existingSlot.startTime = nextMonday;
            existingSlot.duration = 30;
            existingSlot.isBooked = false;

            await timeSlotRepository.save(existingSlot);

            // Now try to create a weekly schedule that overlaps with this slot
            const dayAfterMonday = new Date(nextMonday);
            dayAfterMonday.setDate(dayAfterMonday.getDate() + 1);

            const overlappingScheduleData = {
                startDate: nextMonday.toISOString(),
                endDate: dayAfterMonday.toISOString(),
                dailySlots: [
                    {
                        dayOfWeek: nextMonday.getDay(), // Same day as existing slot
                        startTime: "09:00", // Starts at 9:00 AM
                        endTime: "12:00", // Ends at 12:00 PM, overlapping with the 10:00 slot
                        duration: 30,
                        interval: 30,
                    },
                ],
            };

            const response = await request(app)
                .post(`/api/timeslots/barber/${testBarberId}/weekly`)
                .send(overlappingScheduleData)
                .expect(422);

            // Verify error response
            expect(response.body).toHaveProperty("type", "BUSINESS_RULE_ERROR");
            expect(response.body.message).toContain("overlaps");

            // Verify only the original slot exists
            const slots = await timeSlotRepository.find({
                relations: { barber: true },
                where: { barber: { barberId: testBarberId } },
            });
            expect(slots.length).toBe(1);
            expect(slots[0].timeSlotId).toBe(existingSlot.timeSlotId);
        });

        it("should handle a large schedule creation", async () => {
            // Create a 30-day schedule
            const today = new Date();
            const thirtyDaysLater = new Date(today);
            thirtyDaysLater.setDate(thirtyDaysLater.getDate() + 30);

            // Create a schedule for all days of the week
            const dailySlots = [];
            for (let i = 0; i < 7; i++) {
                dailySlots.push({
                    dayOfWeek: i,
                    startTime: "09:00",
                    endTime: "17:00", // 8 hours
                    duration: 60, // 1 hour slots
                    interval: 60, // 1 hour intervals
                });
            }

            const largeScheduleData = {
                startDate: today.toISOString(),
                endDate: thirtyDaysLater.toISOString(),
                dailySlots,
            };

            const response = await request(app)
                .post(`/api/timeslots/barber/${testBarberId}/weekly`)
                .send(largeScheduleData)
                .timeout(10000) // Increase timeout for this large operation
                .expect(201);

            // Verify response
            expect(response.body).toHaveProperty("count");
            expect(response.body.count).toBeGreaterThanOrEqual(200); // Approx 8 slots per day * 30 days = 240

            // Verify slots in database
            const createdSlots = await timeSlotRepository.find({
                relations: { barber: true },
                where: { barber: { barberId: testBarberId } },
            });
            expect(createdSlots.length).toBe(response.body.count);
        });
    });

    // Helper functions
    function getNextDayOfWeek(date: Date, dayOfWeek: number): Date {
        const resultDate = new Date(date);
        resultDate.setDate(
            date.getDate() + ((7 + dayOfWeek - date.getDay()) % 7)
        );
        return resultDate;
    }
});
