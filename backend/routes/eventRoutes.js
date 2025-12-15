const express = require('express');
const { addEvent, getEvents, updateEvent, deleteEvent } = require('../controllers/eventController');
const { authenticateToken, checkPermission } = require('../middleware/auth');

const router = express.Router();

router.post('/add-event', authenticateToken, checkPermission('canCreateEvent'), addEvent);
router.get('/', authenticateToken, getEvents);
router.put('/:id', authenticateToken, checkPermission('canCreateEvent'), updateEvent);
router.delete('/:id', authenticateToken, checkPermission('canCreateEvent'), deleteEvent);

module.exports = router;
