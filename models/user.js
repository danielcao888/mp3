// Load required packages
var mongoose = require('mongoose');

//assume each task can only be assigned to one user
// Define our user schema
var UserSchema = new mongoose.Schema({
    name:String,
    email:String,
    pendingTasks:{type:[String], default: []}, //will be set to nothing if not given value
    dateCreated: {type:Date, default: Date.now} //user doesnt touch this, set by server
});

//define the task schema
var TaskSchema = new mongoose.Schema({
    name:String,
    description:String,
    deadline:Date,
    completed:{type:Boolean, default:false}, //will be set to falseif given nothing
    assignedUser:{type:String, default:""}, //assigned user that the tasks points to
    assignedUserName:{type:String, default:"unassigned"},
    dateCreated:{type:Date, default: Date.now} //we use default,user doesnt touch this 
});
// Export the Mongoose model
module.exports = {
    User: mongoose.model('User', UserSchema),
    Task: mongoose.model('Task', TaskSchema)
};
