import { Router } from "express";
import { AppointmentController } from "../Controllers/AppointmentController";
import { enhancedDebugMiddleware } from "../debugMiddleware";

const router = Router();
const appointmentController = new AppointmentController();

router.use(enhancedDebugMiddleware);

// General appointment operations
router.get("/", appointmentController.getAllAppointments);
router.post("/", appointmentController.createAppointment);
router.get("/:appointmentId", appointmentController.getAppointmentById);
router.post("/:appointmentId/cancel", appointmentController.cancelAppointment);

// User/Barber specific appointment lists
router.get("/user/:userId", appointmentController.getAppointmentsByUserId);
router.get(
    "/barber/:barberId",
    appointmentController.getAppointmentsByBarberId
);

export default router;
