import request from "supertest";
import { app } from "../server";
import { v4 as uuidv4 } from "uuid";
import { AppDataSource } from "../Infra/Database/DataSource";
import { BarberORM } from "../Infra/ORM/BarberORM";
import { TimeSlotORM } from "../Infra/ORM/TimeSlotORM";
import { AppointmentORM } from "../Infra/ORM/AppointmentORM";
import { UserORM } from "../Infra/ORM/UserORM";
import { Repository } from "typeorm";

describe("Appointment API Tests", () => {
    let barberRepository: Repository<BarberORM>;
    let timeSlotRepository: Repository<TimeSlotORM>;
    let appointmentRepository: Repository<AppointmentORM>;
    let userRepository: Repository<UserORM>;

    let testBarberId: string;
    let testUserId: string;
    let testTimeSlotId: string;
    let testAppointmentId: string;

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
        userRepository = AppDataSource.getRepository(UserORM);

        // Clean up existing test data
        await cleanupDatabases();

        // Create test data (barber, user, and timeslot)
        await createTestData();
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
            await userRepository.query("DELETE FROM user_orm");
            await barberRepository.query("DELETE FROM barber_orm");
        } catch (error) {
            console.error("Error cleaning up databases:", error);
        }
    }

    // Helper to create all necessary test data
    async function createTestData() {
        // Create test barber with valid phone number
        const barber = new BarberORM();
        barber.barberId = uuidv4();
        barber.firstName = "appointment";
        barber.lastName = "testbarber";
        const savedBarber = await barberRepository.save(barber);
        testBarberId = savedBarber.barberId;

        // Create test user with valid phone number
        const user = new UserORM();
        user.userId = uuidv4();
        user.firstName = "appointment";
        user.lastName = "testuser";
        user.phoneNumber = "+972501234567"; // Valid Israeli phone number
        const savedUser = await userRepository.save(user);
        testUserId = savedUser.userId;

        // Create test timeslot
        const tomorrow = new Date();
        tomorrow.setDate(tomorrow.getDate() + 1);
        tomorrow.setHours(10, 0, 0, 0);

        const timeSlot = new TimeSlotORM();
        timeSlot.timeSlotId = uuidv4();
        timeSlot.startTime = tomorrow;
        timeSlot.duration = 20;
        timeSlot.isBooked = false;
        timeSlot.barber = { barberId: testBarberId } as any;

        const savedTimeSlot = await timeSlotRepository.save(timeSlot);
        testTimeSlotId = savedTimeSlot.timeSlotId;

        console.log(
            `Created test data - Barber: ${testBarberId}, User: ${testUserId}, TimeSlot: ${testTimeSlotId}`
        );
    }

    describe("POST /api/appointments", () => {
        it("should create a new appointment with valid data", async () => {
            const appointmentData = {
                userId: testUserId,
                barberId: testBarberId,
                timeSlotId: testTimeSlotId,
                note: "I'd like this in pink, please!",
            };

            const response = await request(app)
                .post("/api/appointments")
                .send(appointmentData)
                .expect(201);

            // Save ID for later tests
            testAppointmentId = response.body.id;

            // Validate response
            expect(response.body).toHaveProperty("id");
            expect(typeof response.body.id).toBe("string");
            expect(response.body).toHaveProperty("timeSlotId", testTimeSlotId);
            expect(response.body).toHaveProperty("userId", testUserId);
            expect(response.body).toHaveProperty("barberId", testBarberId);
            expect(response.body).toHaveProperty("isCancelled", false);
            expect(response.body).toHaveProperty("note");
            expect(typeof response.body.note).toBe("string");

            // Verify in database
            const savedAppointment = await appointmentRepository.findOne({
                where: { appointmentId: response.body.id },
                relations: { user: true, barber: true, timeSlot: true },
            });

            expect(savedAppointment).not.toBeNull();
            expect(savedAppointment?.user.userId).toBe(testUserId);
            expect(savedAppointment?.barber.barberId).toBe(testBarberId);
            expect(savedAppointment?.timeSlot.timeSlotId).toBe(testTimeSlotId);

            // Verify time slot is now booked
            const bookedTimeSlot = await timeSlotRepository.findOneBy({
                timeSlotId: testTimeSlotId,
            });
            expect(bookedTimeSlot?.isBooked).toBe(true);
        });

        it("should reject booking an already booked time slot", async () => {
            // Create another test user with valid phone number
            const anotherUser = new UserORM();
            anotherUser.userId = uuidv4();
            anotherUser.firstName = "another";
            anotherUser.lastName = "user";
            anotherUser.phoneNumber = "+972509876543"; // Valid Israeli phone number
            const savedUser = await userRepository.save(anotherUser);

            // Try to book the same time slot (which is now booked)
            const appointmentData = {
                userId: savedUser.userId,
                barberId: testBarberId,
                timeSlotId: testTimeSlotId, // Already booked in previous test
            };

            const response = await request(app)
                .post("/api/appointments")
                .send(appointmentData)
                .expect(422);

            expect(response.body).toHaveProperty("type", "BUSINESS_RULE_ERROR");
            expect(response.body.message).toContain("already booked");
        });

        it("should reject appointment with non-existent user", async () => {
            // Create a new time slot
            const tomorrow = new Date();
            tomorrow.setDate(tomorrow.getDate() + 1);
            tomorrow.setHours(11, 0, 0, 0);

            const newTimeSlot = new TimeSlotORM();
            newTimeSlot.timeSlotId = uuidv4();
            newTimeSlot.startTime = tomorrow;
            newTimeSlot.duration = 20;
            newTimeSlot.isBooked = false;
            newTimeSlot.barber = { barberId: testBarberId } as any;

            const savedTimeSlot = await timeSlotRepository.save(newTimeSlot);

            const appointmentData = {
                userId: uuidv4(), // Non-existent user ID
                barberId: testBarberId,
                timeSlotId: savedTimeSlot.timeSlotId,
            };

            const response = await request(app)
                .post("/api/appointments")
                .send(appointmentData)
                .expect(404);

            expect(response.body).toHaveProperty("type", "NOT_FOUND");
        });

        it("should reject appointment with non-existent time slot", async () => {
            const appointmentData = {
                userId: testUserId,
                barberId: testBarberId,
                timeSlotId: uuidv4(), // Non-existent time slot ID
            };

            const response = await request(app)
                .post("/api/appointments")
                .send(appointmentData)
                .expect(404);

            expect(response.body).toHaveProperty("type", "NOT_FOUND");
        });

        it("should reject appointment with time slot in the past", async () => {
            // Create a time slot in the past
            const yesterday = new Date();
            yesterday.setDate(yesterday.getDate() - 1);
            yesterday.setHours(10, 0, 0, 0);

            const pastTimeSlot = new TimeSlotORM();
            pastTimeSlot.timeSlotId = uuidv4();
            pastTimeSlot.startTime = yesterday;
            pastTimeSlot.duration = 20;
            pastTimeSlot.isBooked = false;
            pastTimeSlot.barber = { barberId: testBarberId } as any;

            const savedPastTimeSlot = await timeSlotRepository.save(
                pastTimeSlot
            );

            const appointmentData = {
                userId: testUserId,
                barberId: testBarberId,
                timeSlotId: savedPastTimeSlot.timeSlotId,
            };

            const response = await request(app)
                .post("/api/appointments")
                .send(appointmentData)
                .expect(422);

            expect(response.body).toHaveProperty("type", "BUSINESS_RULE_ERROR");
            expect(response.body.message).toContain("past");
        });
    });

    describe("GET /api/appointments/:appointmentId", () => {
        it("should return a specific appointment by ID", async () => {
            const response = await request(app)
                .get(`/api/appointments/${testAppointmentId}`)
                .expect(200);

            expect(response.body).toHaveProperty("id", testAppointmentId);
            expect(response.body).toHaveProperty("userId", testUserId);
            expect(response.body).toHaveProperty("barberId", testBarberId);
            expect(response.body).toHaveProperty("timeSlotId", testTimeSlotId);
        });

        it("should return 404 for non-existent appointment ID", async () => {
            const nonExistentId = uuidv4();

            const response = await request(app)
                .get(`/api/appointments/${nonExistentId}`)
                .expect(404);

            expect(response.body).toHaveProperty("type", "NOT_FOUND");
        });
    });

    describe("GET /api/appointments", () => {
        it("should return a list of appointments", async () => {
            const response = await request(app)
                .get("/api/appointments")
                .expect(200);

            expect(response.body).toHaveProperty("appointments");
            expect(Array.isArray(response.body.appointments)).toBe(true);
            expect(response.body).toHaveProperty("count");

            // Verify our test appointment is in the list
            const testAppointment = response.body.appointments.find(
                (a: { id: string }) => a.id === testAppointmentId
            );
            expect(testAppointment).toBeDefined();
        });

        it("should filter active appointments", async () => {
            const response = await request(app)
                .get("/api/appointments?status=active")
                .expect(200);

            // All returned appointments should be active (not cancelled)
            response.body.appointments.forEach(
                (appointment: { isCancelled: any }) => {
                    expect(appointment.isCancelled).toBe(false);
                }
            );

            // Verify our test appointment is in the active list
            const testAppointment = response.body.appointments.find(
                (a: { id: string }) => a.id === testAppointmentId
            );
            expect(testAppointment).toBeDefined();
        });
    });

    describe("GET /api/appointments/user/:userId", () => {
        it("should return appointments for a specific user", async () => {
            const response = await request(app)
                .get(`/api/appointments/user/${testUserId}`)
                .expect(200);

            expect(response.body).toHaveProperty("appointments");
            expect(Array.isArray(response.body.appointments)).toBe(true);

            // All appointments should belong to the requested user
            response.body.appointments.forEach(
                (appointment: { userId: any }) => {
                    expect(appointment.userId).toBe(testUserId);
                }
            );

            // Verify our test appointment is in the results
            const testAppointment = response.body.appointments.find(
                (a: { id: string }) => a.id === testAppointmentId
            );
            expect(testAppointment).toBeDefined();
        });
    });

    describe("GET /api/appointments/barber/:barberId", () => {
        it("should return appointments for a specific barber", async () => {
            const response = await request(app)
                .get(`/api/appointments/barber/${testBarberId}`)
                .expect(200);

            expect(response.body).toHaveProperty("appointments");
            expect(Array.isArray(response.body.appointments)).toBe(true);

            // All appointments should belong to the requested barber
            response.body.appointments.forEach(
                (appointment: { barberId: any }) => {
                    expect(appointment.barberId).toBe(testBarberId);
                }
            );

            // Verify our test appointment is in the results
            const testAppointment = response.body.appointments.find(
                (a: { id: string }) => a.id === testAppointmentId
            );
            expect(testAppointment).toBeDefined();
        });
    });

    describe("POST /api/appointments/:appointmentId/cancel", () => {
        it("should cancel an existing appointment", async () => {
            // Create an appointment to cancel
            // First create a time slot
            const tomorrow = new Date();
            tomorrow.setDate(tomorrow.getDate() + 1);
            tomorrow.setHours(14, 0, 0, 0);

            const timeSlot = new TimeSlotORM();
            timeSlot.timeSlotId = uuidv4();
            timeSlot.startTime = tomorrow;
            timeSlot.duration = 20;
            timeSlot.isBooked = false;
            timeSlot.barber = { barberId: testBarberId } as any;

            const savedTimeSlot = await timeSlotRepository.save(timeSlot);

            // Create appointment for this time slot
            const appointmentData = {
                userId: testUserId,
                barberId: testBarberId,
                timeSlotId: savedTimeSlot.timeSlotId,
            };

            const createResponse = await request(app)
                .post("/api/appointments")
                .send(appointmentData)
                .expect(201);

            const appointmentToCancel = createResponse.body.id;
            // Now cancel it
            const response = await request(app)
                .post(`/api/appointments/${appointmentToCancel}/cancel`)
                .expect(200);

            console.warn(createResponse.body);
            console.warn(response.body);

            expect(response.body).toHaveProperty("id", appointmentToCancel);
            expect(response.body).toHaveProperty("isCancelled", true);

            // Verify the time slot is now available again
            const updatedTimeSlot = await timeSlotRepository.findOneBy({
                timeSlotId: savedTimeSlot.timeSlotId,
            });

            expect(updatedTimeSlot?.isBooked).toBe(false);
        });

        it("should reject cancellation when too close to appointment time", async () => {
            // Create a time slot for soon (less than 4 hours)
            const soon = new Date();
            soon.setHours(soon.getHours() + 1);

            const timeSlot = new TimeSlotORM();
            timeSlot.timeSlotId = uuidv4();
            timeSlot.startTime = soon;
            timeSlot.duration = 20;
            timeSlot.isBooked = false;
            timeSlot.barber = { barberId: testBarberId } as any;

            const savedTimeSlot = await timeSlotRepository.save(timeSlot);

            // Book the time slot
            const appointmentData = {
                userId: testUserId,
                barberId: testBarberId,
                timeSlotId: savedTimeSlot.timeSlotId,
            };

            const createResponse = await request(app)
                .post("/api/appointments")
                .send(appointmentData)
                .expect(201);

            const appointmentId = createResponse.body.id;

            // Try to cancel
            const response = await request(app)
                .post(`/api/appointments/${appointmentId}/cancel`)
                .expect(422);

            expect(response.body).toHaveProperty("type", "BUSINESS_RULE_ERROR");
            expect(response.body.message).toContain(
                "Cannot cancel appointment"
            );
        });
    });
});
