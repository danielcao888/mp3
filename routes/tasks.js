const { User, Task } = require('../models/user');

module.exports = function (router) {

    //tasks 
    //GET to respond with a list of tasks
    router.get('/',async(req,res)=> {
        try {
            let query = Task.find(); //create initial query builder to run query on with all tasks
            //create new task 
            
            //do where (req.query.where) gets json parameters,otherwise will be undefined
            if (req.query.where){ //only edit query if where has actual valid value
                try {
                    const whereCondition = JSON.parse(req.query.where) //convert to json object
                    query = query.find(whereCondition) //pass in the json to runthe query
                } catch { //if query fails, it was bad request
                    return res.status(400).json({message:"Invalid Request: invalid where json", data:{}})
                }
                
            }
            //do sort
            if (req.query.sort) {
                try {
                    const sortCondition = JSON.parse(req.query.sort)
                    query = query.sort(sortCondition) //will sort automatically by 1(ascending), -1(descending)
                } catch { //if query fails, it was bad request
                    return res.status(400).json({message:"Invalid Request: invalid sort json", data:{}})
                }
            }
            //do select (to specify what fields should be included or not)
            if (req.query.select) {
                try {
                    const selectCondition = JSON.parse(req.query.select)
                    query = query.select(selectCondition)
                } catch { //if query fails, it was bad request
                    return res.status(400).json({message:"Invalid Request: invalid select json", data:{}})
                }
            }
            //do skip (specify how much to skip)
            if(req.query.skip) {
                const skipNum = Number(req.query.skip)
                if(isNaN(skipNum)){ //if not a number, then return invalid request
                    return res.status(400).json({message:"Invalid Request: skip must be a numerical value", data:{}})
                }
                query = query.skip(skipNum)
            }

            //apply user limit if set, otherwise return 100
            if(req.query.limit) {
                const limitNum = Number(req.query.limit)
                if(isNaN(limitNum)){ //if not a number, then return invalid request
                    return res.status(400).json({message:"Invalid Request: limit must be a numerical value", data:{}})
                } 
                query=query.limit(limitNum)
            } else {//if not set, set to default of 100
                query = query.limit(100)
            }

            //if set and set to true 
            if(req.query.count && req.query.count == "true"){
                //apply the where if where not applied 
                let where = {}
                if (req.query.where){ //error handling already handled previously
                    where = JSON.parse(req.query.where)
                }

                const count = await Task.countDocuments(where) //this will be final query, return and call asynchronously
                return res.status(200).json({ message: "OK", data: count}) //return early since we are just getting count
            } 

            const tasks = await query; //run final query
            return res.status(200).json({message:"OK",data:tasks});


        } catch (err) {
            return res.status(500).json({
                message:"Server Error",
                data:{}
            })
        }
    });


    //POST to create new task and respond with details of task
    router.post('/', async (req, res) => {
    try {
        const {name, description, deadline, assignedUser} = req.body;

        if (!name) {
            return res.status(400).json({ message: "Invalid Request: name is required", data: {} });
        }

        if (!deadline) {
            return res.status(400).json({ message: "Invalid Request: deadline is required", data: {} });
        }

        //make new task with name, descriotion,and deadline
        let newTask = new Task({
            name,
            description,
            deadline
        });

        //update user db if assigned user provided
        if (assignedUser && assignedUser.trim() !== "") {
            const user = await User.findById(assignedUser);

            if (!user) {
                return res.status(400).json({
                    message: "Invalid Request: assigned user does not exist",
                    data: {}
                });
            }

            newTask.assignedUser = user._id.toString();
            newTask.assignedUserName = user.name;
        }

        const savedTask = await newTask.save();

        // Update user's pendingTasks if assigned
        if (savedTask.assignedUser !== "") {
            await User.findByIdAndUpdate(savedTask.assignedUser, {
                $addToSet: { pendingTasks: savedTask._id.toString() }
            });
        }

        return res.status(201).json({ message: "Task created", data: savedTask });

    } catch (error) {
        return res.status(500).json({ message: "Server Error", data: {} });
    }
});


    //tasks:id
    
    //GET to Respond with details of specified task or 404 error
    router.get('/:id', async (req, res) => {
    try {
        let query = Task.findById(req.params.id);

        if (req.query.select) {
            try {
                const selectCondition = JSON.parse(req.query.select);
                query = query.select(selectCondition);
            } catch {
                return res.status(400).json({ message: "Invalid Request: invalid select JSON", data: {} });
            }
        }

        const task = await query.exec();

        if (!task) {
            return res.status(404).json({ message: "Task not found", data: {} });
        }

        return res.status(200).json({ message: "OK", data: task });

    } catch {
        return res.status(500).json({ message: "Server Error", data: {} });
    }
    });


    //PUT to replace entire task with supplied task or 404 error
    router.put('/:id', async (req, res) => {
    try {
        const { name, description, deadline, assignedUser, completed } = req.body;

        if (!name) {
            return res.status(400).json({ message: "Invalid Request: name is required", data: {} });
        }

        if (!deadline) {
            return res.status(400).json({ message: "Invalid Request: deadline is required", data: {} });
        }

        let task = await Task.findById(req.params.id);
        if (!task) {
            return res.status(404).json({ message: "Task not found", data: {} });
        }

        // If reassigning, first check that the user actullauy is there
        let newAssignedUser = "";
        let newAssignedUserName = "unassigned";

        if (assignedUser && assignedUser.trim() !== "") {
            const user = await User.findById(assignedUser);
            if (!user) {
                return res.status(400).json({ message: "Invalid Request: assigned user does not exist", data: {} });
            }
            newAssignedUser = user._id.toString();
            newAssignedUserName = user.name;
        }

        // If task was previously assigned to someone then remove it from old pending tasks
        if (task.assignedUser !== "") {
            await User.findByIdAndUpdate(task.assignedUser, {
                $pull: { pendingTasks: task._id.toString() }
            });
        }

        // Update the task fields
        task.name = name;
        task.description = description;
        task.deadline = deadline;
        if (completed === undefined) { //set to false if not given
            task.completed = false;
        } else {
            task.completed = completed;
        }
        task.assignedUser = newAssignedUser;
        task.assignedUserName = newAssignedUserName;

        const savedTask = await task.save();

        //add to pending tasks if needed
        if (savedTask.assignedUser !== "") {
            await User.findByIdAndUpdate(savedTask.assignedUser, {
                $addToSet: { pendingTasks: savedTask._id.toString() }
            });
        }

        return res.status(200).json({ message: "Task sucessfully updated", data: savedTask });

    } catch {
        return res.status(500).json({ message: "Server Error", data: {} });
    }
});
    //DELETE to delete specified task or 404 error
    router.delete('/:id', async (req, res) => {
    try {
        const taskToDelete = await Task.findById(req.params.id);
        if (!taskToDelete) {
            return res.status(404).json({ message: "Task not found", data: {} });
        }

        // If task was assigned remove from users
        if (taskToDelete.assignedUser !== "") {
            await User.findByIdAndUpdate(taskToDelete.assignedUser, {
                $pull: { pendingTasks: taskToDelete._id.toString() }
            });
        }

        await Task.findByIdAndDelete(req.params.id);

        return res.status(200).json({ message: "Task deleted", data: {} });

    } catch {
        return res.status(500).json({ message: "Server Error", data: {} });
    }
});
    return router;
}