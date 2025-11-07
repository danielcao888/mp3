

//concurencyt transactions?
const { User, Task } = require('../models/user');
module.exports = function (router) {

    //users get
    router.get('/', async (req, res) => {
        try {
            let query = User.find();

            if (req.query.where) {
                try {
                    const whereCondition = JSON.parse(req.query.where)
                    query = query.find(whereCondition)
                } catch {
                    return res.status(400).json({message:"Invalid Request: invalid where json", data:{}})
                }
            }

            if (req.query.sort) {
                try {
                    const sortCondition = JSON.parse(req.query.sort)
                    query = query.sort(sortCondition)
                } catch {
                    return res.status(400).json({message:"Invalid Request: invalid sort json", data:{}})
                }
            }

            if (req.query.select) {
                try {
                    const selectCondition = JSON.parse(req.query.select)
                    query = query.select(selectCondition)
                } catch {
                    return res.status(400).json({message:"Invalid Request: invalid select json", data:{}})
                }
            }

            if (req.query.skip) {
                const skipNum = Number(req.query.skip)
                if (isNaN(skipNum)) {
                    return res.status(400).json({message:"Invalid Request: skip must be a numerical value", data:{}})
                }
                query = query.skip(skipNum)
            }

            if (req.query.limit) {
                const limitNum = Number(req.query.limit)
                if (isNaN(limitNum)) {
                    return res.status(400).json({message:"Invalid Request: limit must be a numerical value", data:{}})
                }
                query = query.limit(limitNum)
            }
            //this time we do unlimited amount of users as default

            if (req.query.count && req.query.count == "true") {
                let where = {}
                if (req.query.where) {
                    where = JSON.parse(req.query.where)
                }

                const count = await User.countDocuments(where)
                return res.status(200).json({ message: "OK", data: count})
            }

            const users = await query;
            return res.status(200).json({message:"OK",data:users});

        } catch (err) {
            return res.status(500).json({message:"Server Error",data:{}})
        }  
    });

    //users post(create new user, and respond with details of the user)
    router.post('/', async(req,res)=>{//create user with email and no pending tasks
        try {
            const {name, email} = req.body

            if(!name) {
                return res.status(400).json({ message: "Invalid Request: name is required", data: {} });
            }

            if(!email) {
                return res.status(400).json({ message: "Invalid Request: email is required", data: {} });
            }

            const existingEmail = await User.findOne({email:email}) 

            if(existingEmail) { //check if existing email there, if so return 409 error 
                return res.status(409).json({message: "Invalid Request: a user with this email already exists", data: {}});
            }
            const newUser = new User({name, email}); //creates the mongoosemodel object
            const saved = await newUser.save(); //takes object and writes to the correspdoning db
            return res.status(201).json({ message: "User created", data: saved });

        } catch(error){
            return res.status(500).json({message:"Server Error",data:{}})
        }
    })
    //users id things

    //get for users id (Respond with details of specified user or 404 error)
    router.get('/:id', async (req, res) => {
    try {
        let query = User.findById(req.params.id);

        if (req.query.select) {
            try {
                const selectCondition = JSON.parse(req.query.select);
                query = query.select(selectCondition);
            } catch {
                return res.status(400).json({ message: "Invalid Request: invalid select JSON", data: {} });
            }
        }

        const user = await query.exec();

        if (!user) {
            return res.status(404).json({ message: "User not found", data: {} });
        }

        return res.status(200).json({ message: "OK", data: user });

    } catch {
        return res.status(500).json({ message: "Server Error", data: {} });
    }
});

    //update existing user
    router.put('/:id', async (req, res) => {
    try {
        const { name, email, pendingTasks } = req.body;

        //if no name or email, we say invalid
        if (!name) {
            return res.status(400).json({ message: "Invalid Request: name is required", data: {} });
        }

        if (!email) {
            return res.status(400).json({ message: "Invalid Request: email is required", data: {} });
        }

        let user = await User.findById(req.params.id);
        if (!user) { //if no usre we return a 404
            return res.status(404).json({ message: "User not found", data: {} });
        }

        const existingEmail = await User.findOne({email:email}) 

        //check if another user has same emial 
        if (existingEmail && existingEmail._id.toString() !== user._id.toString()) {
            return res.status(409).json({ message: "Invalid Request: a user with this email already exists", data: {}
            });
        }


        // Remove user assignment from all the old tasks
        const oldTasks = user.pendingTasks;
        for (let taskId of oldTasks) {
            await Task.findByIdAndUpdate(taskId, {assignedUser: "", assignedUserName: "unassigned"});
        }

        // Update the user fields
        user.name = name;
        user.email = email;

        // Build out pendingTasks list & reassign tasks
        let newTaskList = [];
        if (pendingTasks && pendingTasks.length > 0) {
            for (let taskId of pendingTasks) {
                const task = await Task.findById(taskId);
                if (!task) {
                    return res.status(400).json({ message: "Invalid Request: one or more tasks do not exist", data: {} });
                }

                task.assignedUser = user._id.toString();
                task.assignedUserName = user.name;
                await task.save();

                newTaskList.push(taskId);
            }
        }

        user.pendingTasks = newTaskList;

        const saved = await user.save();
        return res.status(200).json({ message: "User updated", data: saved });

    } catch {
        return res.status(500).json({ message: "Server Error", data: {} });
    }
});


    //delete for users id (Delete specific user or 404 error)
    router.delete('/:id', async (req, res) => {
    try {
        const user = await User.findById(req.params.id);
        if (!user) {
            return res.status(404).json({ message: "User not found", data: {} });
        }

        // Unassign all the tasks from this user nefore deleting
        const tasks = user.pendingTasks;
        for (let taskId of tasks) {
            await Task.findByIdAndUpdate(taskId, { assignedUser: "", assignedUserName: "unassigned"});
        }

        await User.findByIdAndDelete(req.params.id);

        return res.status(200).json({ message: "User deleted", data: {} });

    } catch {
        return res.status(500).json({ message: "Server Error", data: {} });
    }
});

    return router;
}