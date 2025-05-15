import request from "supertest";
import { app } from "../server";
import { v4 as uuidv4 } from "uuid";
import { AppDataSource } from "../Infra/Database/DataSource";
import { UserORM } from "../Infra/ORM/UserORM";
import { AppointmentORM } from "../Infra/ORM/AppointmentORM";
import { Repository } from "typeorm";

describe("User API Endpoints", () => {
    let userRepository: Repository<UserORM>;
    let appointmentRepository: Repository<AppointmentORM>;
    let createdUserId: string;

    // Helper to create a unique test user
    const createUniqueTestUser = () => ({
        id: uuidv4(),
        firstName: `test_${Date.now()}`,
        lastName: `user_${Math.floor(Math.random() * 10000)}`,
        phoneNumber: "+972501234567",
    });

    beforeAll(async () => {
        // Make sure database is initialized
        if (!AppDataSource.isInitialized) {
            await AppDataSource.initialize();
        }
        userRepository = AppDataSource.getRepository(UserORM);
        appointmentRepository = AppDataSource.getRepository(AppointmentORM);

        // Clear test data - respecting foreign key constraints
        await appointmentRepository.query("DELETE FROM appointment_orm");
        await userRepository.query("DELETE FROM user_orm");
    });

    afterAll(async () => {
        // Clean up after tests - respecting foreign key constraints
        if (AppDataSource.isInitialized) {
            await appointmentRepository.query("DELETE FROM appointment_orm");
            await userRepository.query("DELETE FROM user_orm");
            await AppDataSource.destroy();
        }
    });

    describe("POST /api/users", () => {
        it("should create a new user with valid data", async () => {
            const userData = createUniqueTestUser();

            const response = await request(app)
                .post("/api/users")
                .send(userData)
                .expect(201);

            // Store the created ID for later tests
            createdUserId = response.body.id;

            // Check the response format
            expect(response.body).toHaveProperty("id");
            expect(typeof response.body.id).toBe("string");
            expect(response.body.firstName).toBe(
                userData.firstName.toLowerCase()
            );
            expect(response.body.lastName).toBe(
                userData.lastName.toLowerCase()
            );
            expect(response.body.phoneNumber).toBe(userData.phoneNumber);
        });

        it("should reject when firstName is too short", async () => {
            const userData = createUniqueTestUser();
            userData.firstName = "A"; // Too short per Zod validation

            const response = await request(app)
                .post("/api/users")
                .send(userData)
                .expect(400);

            // Check new error format
            expect(response.body).toHaveProperty("type", "VALIDATION_ERROR");
            expect(response.body).toHaveProperty(
                "message",
                "Validation failed"
            );
            expect(response.body).toHaveProperty("errors");
            expect(Array.isArray(response.body.errors)).toBe(true);

            // At least one error should be about firstName
            const firstNameError = response.body.errors.find((err: any) =>
                err.path.includes("firstName")
            );
            expect(firstNameError).toBeDefined();
        });

        it("should reject when lastName is too short", async () => {
            const userData = createUniqueTestUser();
            userData.lastName = "B"; // Too short per Zod validation

            const response = await request(app)
                .post("/api/users")
                .send(userData)
                .expect(400);

            // Check new error format
            expect(response.body).toHaveProperty("type", "VALIDATION_ERROR");
            expect(response.body).toHaveProperty("errors");

            // At least one error should be about lastName
            const lastNameError = response.body.errors.find((err: any) =>
                err.path.includes("lastName")
            );
            expect(lastNameError).toBeDefined();
        });

        it("should reject when phoneNumber is not a number", async () => {
            const userData = createUniqueTestUser();

            const response = await request(app)
                .post("/api/users")
                .send({
                    ...userData,
                    phoneNumber: "not-a-number",
                })
                .expect(400);

            // Check new error format
            expect(response.body).toHaveProperty("type", "VALIDATION_ERROR");
            expect(response.body).toHaveProperty("errors");

            // At least one error should be about phoneNumber
            const phoneError = response.body.errors.find((err: any) =>
                err.path.includes("phoneNumber")
            );
            expect(phoneError).toBeDefined();
        });

        it("should reject when required fields are missing", async () => {
            const response = await request(app)
                .post("/api/users")
                .send({
                    firstName: "TestFirstName",
                    // Missing lastName and phoneNumber
                })
                .expect(400);

            // Check new error format
            expect(response.body).toHaveProperty("type", "VALIDATION_ERROR");
            expect(response.body).toHaveProperty("errors");
            expect(response.body.errors.length).toBeGreaterThan(0);
        });
    });

    describe("GET /api/users/:id", () => {
        it("should return a user by valid ID", async () => {
            // Skip if no user was created
            if (!createdUserId) {
                console.warn("No user ID available, skipping test");
                return;
            }

            const response = await request(app)
                .get(`/api/users/${createdUserId}`)
                .expect(200);

            expect(response.body).toHaveProperty("id", createdUserId);
            expect(response.body).toHaveProperty("firstName");
            expect(response.body).toHaveProperty("lastName");
            expect(response.body).toHaveProperty("phoneNumber");
        });

        it("should return 404 for non-existent user ID", async () => {
            const nonExistentId = uuidv4(); // Generate a random UUID that won't exist

            const response = await request(app)
                .get(`/api/users/${nonExistentId}`)
                .expect(404);

            // Check new error format
            expect(response.body).toHaveProperty("type", "NOT_FOUND");
            expect(response.body).toHaveProperty("message");
            expect(response.body.message).toContain("not found");
        });

        it("should handle invalid ID format", async () => {
            const response = await request(app)
                .get("/api/users/invalid-id-format")
                .expect(400); // 400 is returned for bad requests

            // Check new error format
            expect(response.body).toHaveProperty("type", "VALIDATION_ERROR");
            expect(response.body).toHaveProperty("message");
        });
    });

    describe("GET /api/users/search", () => {
        let searchUser: UserORM;

        beforeAll(async () => {
            // Create test user with domain-generated UUID
            const testUserData = createUniqueTestUser();

            // Create ORM entity preserving the domain-generated ID
            const user = new UserORM();
            user.userId = testUserData.id; // Set the domain-generated UUID
            user.firstName = testUserData.firstName;
            user.lastName = testUserData.lastName;
            user.phoneNumber = testUserData.phoneNumber;

            // Save to database, maintaining the domain-generated ID
            searchUser = await userRepository.save(user);
        });

        it("should find a user by name", async () => {
            const response = await request(app)
                .get(
                    `/api/users/search?firstName=${searchUser.firstName}&lastName=${searchUser.lastName}`
                )
                .expect(200);

            expect(response.body).toHaveProperty("id");
            expect(response.body.firstName).toBe(searchUser.firstName);
            expect(response.body.lastName).toBe(searchUser.lastName);
        }, 20000); // Increase timeout to avoid test timeouts

        it("should return 404 for non-existent user name", async () => {
            const response = await request(app)
                .get(
                    "/api/users/search?firstName=NonExistent&lastName=UserName"
                )
                .expect(404);

            // Check new error format
            expect(response.body).toHaveProperty("type", "NOT_FOUND");
            expect(response.body).toHaveProperty("message");
            expect(response.body.message).toContain("not found");
        }, 20000); // Increase timeout to avoid test timeouts

        it("should validate name parameters", async () => {
            const response = await request(app)
                .get("/api/users/search?firstName=A&lastName=B")
                .expect(400);

            // Check new error format
            expect(response.body).toHaveProperty("type", "VALIDATION_ERROR");
            expect(response.body).toHaveProperty("errors");
        }, 20000); // Increase timeout to avoid test timeouts

        it("should require both first and last name", async () => {
            const response = await request(app)
                .get("/api/users/search?firstName=OnlyFirst")
                .expect(400);

            // Check new error format
            expect(response.body).toHaveProperty("type", "VALIDATION_ERROR");
            expect(response.body).toHaveProperty("errors");
        }, 20000); // Increase timeout to avoid test timeouts
    });

    describe("GET /api/users", () => {
        beforeAll(async () => {
            // Create test user with domain-generated UUID
            const testUserData = createUniqueTestUser();
            const testUserData2 = createUniqueTestUser();

            // Create ORM entity preserving the domain-generated ID
            const user1 = new UserORM();
            user1.userId = testUserData.id; // Set the domain-generated UUID
            user1.firstName = testUserData.firstName;
            user1.lastName = testUserData.lastName;
            user1.phoneNumber = testUserData.phoneNumber;

            const user2 = new UserORM();
            user2.userId = testUserData2.id; // Set the domain-generated UUID
            user2.firstName = testUserData2.firstName;
            user2.lastName = testUserData2.lastName;
            user2.phoneNumber = testUserData2.phoneNumber;
            // Save to database, maintaining the domain-generated ID
            await userRepository.save(user1);
            await userRepository.save(user2);
        });
        it("should return a list of users with count", async () => {
            const response = await request(app).get("/api/users").expect(200);

            expect(response.body).toHaveProperty("users");
            expect(Array.isArray(response.body.users)).toBe(true);
            expect(response.body).toHaveProperty("count");
            expect(typeof response.body.count).toBe("number");

            // Check the structure of returned user objects
            if (response.body.users.length > 0) {
                const firstUser = response.body.users[0];
                expect(firstUser).toHaveProperty("id");
                expect(firstUser).toHaveProperty("firstName");
                expect(firstUser).toHaveProperty("lastName");
                expect(firstUser).toHaveProperty("phoneNumber");
            }
        });
    });

    describe("Error Handling", () => {
        // Add a test route that always throws an error

        it("should handle invalid JSON in request body", async () => {
            const response = await request(app)
                .post("/api/users")
                .set("Content-Type", "application/json")
                .send("{invalid-json}")
                .expect(400);

            expect(response.body).toHaveProperty("type", "VALIDATION_ERROR");
            expect(response.body).toHaveProperty("errors");
            // Check that the errors array contains our specific message
            expect(response.body.errors[0]).toHaveProperty(
                "error",
                "Invalid JSON format in request body"
            );
        });

        it("should handle unexpected errors gracefully", async () => {
            const response = await request(app).post("/test/error").expect(500);
            console.warn(response);
            expect(response.body).toHaveProperty("type", "UNEXPECTED_ERROR");
            expect(response.body).toHaveProperty("message");
        });
    });
});
