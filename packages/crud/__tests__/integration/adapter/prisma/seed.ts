import prisma from "./client";

// eslint-disable-next-line import/prefer-default-export,func-style
export async function createSeedData(): Promise<void> {
    /**
     * USERS
     */
    const user1 = await prisma.user.create({
        data: {
            email: "johndoe1@gmail.com",
            name: "John Doe",
        },
    });

    const user2 = await prisma.user.create({
        data: {
            email: "johndoe2@gmail.com",
            name: "John Doe",
        },
    });

    const user3 = await prisma.user.create({
        data: {
            email: "johndoe3@gmail.com",
            name: "John Doe",
        },
    });

    const user4 = await prisma.user.create({
        data: {
            email: "johndoe4@gmail.com",
            name: "John Doe",
        },
    });

    /**
     * POSTS
     */
    const post1 = await prisma.post.create({
        data: {
            author: {
                connect: {
                    id: user1.id,
                },
            },

            content: "Lorem ipsum",
        },
    });

    const post2 = await prisma.post.create({
        data: {
            author: {
                connect: {
                    id: user2.id,
                },
            },
            content: "Lorem ipsum",
        },
    });

    /**
     * COMMENTS
     */
    await prisma.comment.create({
        data: {
            author: {
                connect: {
                    id: user3.id,
                },
            },
            content: "Lorem ipsum",
            post: {
                connect: {
                    id: post1.id,
                },
            },
        },
    });

    await prisma.comment.create({
        data: {
            author: {
                connect: {
                    id: user4.id,
                },
            },
            content: "Lorem ipsum",
            post: {
                connect: {
                    id: post2.id,
                },
            },
        },
    });
}
