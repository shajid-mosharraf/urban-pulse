const router = require("express").Router();
const userController = require("../controllers/userController");

router.get("/", userController.getAllUsers);

// When someone POSTs to /, run the SQL for 'createUser'
router.post("/", userController.createUser);

module.exports = router;