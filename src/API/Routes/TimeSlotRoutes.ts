import { Router } from "express";
import { TimeSlotController } from "../Controllers/TimeSlotController";

const router = Router();
const timeSlotController = new TimeSlotController();

// Direct timeslot access
router.get("/:timeslotId", timeSlotController.getTimeSlotById);

// Barber-specific timeslot operations
router.get("/barber/:barberId", timeSlotController.getTimeSlotsByBarberId);
router.post("/barber/:barberId", timeSlotController.createTimeSlot);
router.post(
    "/barber/:barberId/weekly",
    timeSlotController.createWeeklySchedule
);
router.delete(
    "/barber/:barberId/:timeslotId",
    timeSlotController.deleteTimeSlot
);

export default router;
