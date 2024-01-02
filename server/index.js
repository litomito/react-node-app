const express = require('express');
const path = require('path');
const { PrismaClient } = require('@prisma/client');
const bodyParser = require('body-parser');
const session = require('express-session');
const cors = require('cors');
const crypto = require('crypto');
const jwt = require('jsonwebtoken');
const { error } = require('console');
const { decode } = require('punycode');
const bcrypt = require('bcrypt');

const prisma = new PrismaClient();
const app = express();

app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));
app.use(cors({
    origin: 'http://localhost:3000',
    credentials: true,
}));

const sessionSecret = crypto.randomBytes(64).toString('hex');
const tokenSecret = crypto.randomBytes(64).toString('hex');

app.use(session({
    secret: sessionSecret,
    resave: false,
    saveUninitialized: true,
}));

app.use((req, res, next) => {
    next();
});

const createToken = (userId) => {
    return jwt.sign({ userId }, tokenSecret, { expiresIn: '1h' });
};

const authenticateJWT = (req, res, next) => {
    const token = req.session.token;

    if (!token) {
        return res.status(401).json({ error: 'Unauthorized' });
    }

    jwt.verify(token, tokenSecret, (err, decoded) => {
        if (err) {
            return res.status(403).json({ error: 'Forbidden' });
        }

        req.user = {
            id: decoded.userId
        }

        next();
    });
};

const isAuthenticated = (req, res, next) => {
    if (req.session.token) {
        authenticateJWT(req, res, next);
    } else {
        res.status(401).json({ error: 'Unauthorized' });
    }
};


app.get('/staticposts', isAuthenticated, (req, res) => {
    res.send({ user: req.user });
    res.sendFile(path.join(__dirname, 'client', 'public', 'index.html'));
});

app.get('/posts/:id', isAuthenticated, async (req, res) => {
    const postId = req.params.id;
    try {
        const findPost = await prisma.post.findUnique({
            where: {
                id: parseInt(postId),
            },
            include: {
                comments: {
                    include: {
                        user: true,
                    },
                },
            },
        });

        if (!findPost) {
            return res.status(404).json({ error: "post not found " });
        }

        const formattedDate = new Intl.DateTimeFormat('sv-SE', {
            year: 'numeric',
            month: '2-digit',
            day: '2-digit',
            hour: '2-digit',
            minute: '2-digit',
            timeZone: 'UTC',
        }).format(new Date(findPost.createdAt));

        res.send({ user: req.user, post: { ...findPost, formattedDate } });
    } catch (err) {
        console.error('Error fetching post:', err);
        res.status(500).json({ error: 'Internal server error' });
    }
});

const hashPassword = async (password) => {
    const saltRounds = 10;
    return await bcrypt.hash(password, saltRounds);
};

const comparePasswords = async (password, hashedPassword) => {
    return await bcrypt.compare(password, hashedPassword);
};

app.post('/signup', async (req, res) => {
    const { username, password, profileImage } = req.body;

    try {
        const existingUser = await prisma.user.findUnique({
            where: {
            username,
            },
        });
    
        if (existingUser) {
            return res.status(400).json({ success: false, message: "Username already exists" });
        }
    
        const hashedPassword = await hashPassword(password);
    
        const user = await prisma.user.create({
            data: {
            username,
            password: hashedPassword,
            profileImage,
            },
        });
    
        req.session.token = createToken(user.id);
    
        res.json({ success: true, message: "User created successfully", token: req.session.token });
    } catch (err) {
        console.log("Error during signup:", err);
        res.status(500).json({ success: false, message: "Internal server error" });
    }
});

app.post("/login", async (req, res) => {
    const { username, password } = req.body;
    try {
        const getUser = await prisma.user.findUnique({
            where: {
                username,
            },
        });

    if (getUser) {
        if (getUser.password) {
        const passwordMatch = await comparePasswords(password, getUser.password);

        if (passwordMatch) {
            req.session.token = createToken(getUser.id);
            const userData = {
                id: getUser.id,
                username: getUser.username,
                profileImage: getUser.profileImage,
            };
            res.json({ success: true, token: req.session.token, user: { id: getUser.id, username: getUser.username } });
        } else {
            res.status(401).json({ success: false, message: "Invalid Name or Password" });
        }
        } else {
        res.status(500).json({ success: false, message: "Hashed password not found for the user" });
        }
    } else {
        res.status(401).json({ success: false, message: "Invalid Name or Password" });
    }
    } catch (err) {
    console.log("Error during login:", err);
    res.status(500).json({ success: false, message: "Internal server error" });
    }
});

app.post('/posts/:id/comments', isAuthenticated, async (req, res) => {
    const { id: postId } = req.params;
    const { content } = req.body;

    try {
        const existingPost = await prisma.post.findUnique({
            where: {
                id: parseInt(postId),
            },
        });

        if (!existingPost) {
            return res.status(404).json({ error: "Post not found" });
        }

        const newComment = await prisma.comments.create({
            data: {
                content,
                user: { connect: { id: req.user.id }, },
                post: { connect: { id: existingPost.id } },
            },
            include: {
                user: true,
            },
        });

        await prisma.user.update({
            where: { id: req.user.id },
            data: { admin: true },
        });

        const postWithComments = await prisma.post.findUnique({
            where: {
                id: parseInt(postId),
            },
            include: {
                comments: {
                    include: {
                        user: true,
                    }
                }
            },
        });

        res.json({ post: postWithComments, newComment: newComment });
    } catch (err) {
        console.error("Error adding comment:", err);
        res.status(500).json({ error: "Internal Server Error" });
    }
});

app.put('/posts/:postId/comments/:commentId', isAuthenticated, async (req, res) => {
    const { postId, commentId } = req.params;
    const { content } = req.body;

    try {
        const existingComment = await prisma.comments.findUnique({
            where: {
                id: parseInt(commentId),
            },
            include: {
                user: true,
            },
        });

        if (!existingComment || existingComment.user.id !== req.user.id) {
            return res.status(403).json({ error: 'Forbidden' });
        }

        const updatedComment = await prisma.comments.update({
            where: {
                id: existingComment.id,
            },
            data: {
                content,
            },
        });

        // Fetch the updated post data after editing a comment
        const updatedPost = await prisma.post.findUnique({
            where: {
                id: parseInt(postId),
            },
            include: {
                comments: {
                    include: {
                        user: true,
                    },
                },
            },
        });

        res.json({ success: true, updatedComment, updatedPost });
    } catch (err) {
        console.error('Error updating comment:', err);
        res.status(500).json({ error: 'Internal Server Error' });
    }
});

app.delete('/posts/:postId/comments/:commentId', isAuthenticated, async (req, res) => {
    const { postId, commentId } = req.params;

    try {
        const existingComment = await prisma.comments.findUnique({
            where: {
                id: parseInt(commentId),
            },
            include: {
                user: true,
            },
        });

        if (!existingComment || existingComment.user.id !== req.user.id) {
            return res.status(403).json({ error: 'Forbidden' });
        }

        await prisma.comments.delete({
            where: {
                id: existingComment.id,
            },
        });

        // Fetch the updated post data after deleting a comment
        const updatedPost = await prisma.post.findUnique({
            where: {
                id: parseInt(postId),
            },
            include: {
                comments: {
                    include: {
                        user: true,
                    },
                },
            },
        });

        res.json({ success: true, message: 'Comment deleted successfully', updatedPost });
    } catch (err) {
        console.error('Error deleting comment:', err);
        res.status(500).json({ error: 'Internal Server Error' });
    }
});

app.post('/logout', (req, res) => {
    req.session.destroy((err) => {
        if (err) {
            return res.status(500).json({ error: "Logout failed" });
        }
        res.clearCookie("connect.sid");
        res.json({ success: true, message: "Logout successful" });
    })
})

app.get('/login', (req, res) => {
    if (req.session.token) {
        res.json({ isLoggedIn: true, token: req.session.token });
    } else {
        res.json({ isLoggedIn: false });
    }
});


app.listen(3001, () => {
    console.log("listening on port 3001");
});
