import express from "express";
import { createClient } from "redis";
import { json } from "body-parser";

const DEFAULT_BALANCE = 100;

interface ChargeResult {
    isAuthorized: boolean;
    remainingBalance: number;
    charges: number;
}

async function connect(): Promise<any> {
    const url = `redis://${process.env.REDIS_HOST ?? "localhost"}:${process.env.REDIS_PORT ?? "6379"}`;
    console.log(`Using redis URL ${url}`);
    const client: any = createClient({ url }); // Manually typecast the client object
    await client.connect();
    return client;
}

async function reset(account: string): Promise<void> {
    const client = await connect();
    try {
        await client.set(`${account}/balance`, DEFAULT_BALANCE);
    } finally {
        await client.disconnect();
    }
}

async function charge(account: string, charges: number): Promise<ChargeResult> {
    const client = await connect();
    try {
        const balance = parseInt((await client.get(`${account}/balance`)) ?? "");
        
        // Check if there's enough balance for the charges.
        if (balance >= charges) {
            // Introduce a lock to prevent concurrent deductions.
            const lockKey = `${account}/lock`;
            const lockAcquired = await client.set(lockKey, "locked", "NX", "EX", 10); // Set lock with a 10-second expiration time
            
            if (!lockAcquired) {
                return { isAuthorized: false, remainingBalance: balance, charges: 0 };
            }
            
            try {
                // Double-check the balance inside the lock.
                const currentBalance = parseInt((await client.get(`${account}/balance`)) ?? "");
                if (currentBalance >= charges) {
                    await client.set(`${account}/balance`, currentBalance - charges);
                    const remainingBalance = currentBalance - charges;
                    return { isAuthorized: true, remainingBalance, charges };
                } else {
                    return { isAuthorized: false, remainingBalance: currentBalance, charges: 0 };
                }
            } finally {
                // Release the lock.
                await client.del(lockKey);
            }
        } else {
            return { isAuthorized: false, remainingBalance: balance, charges: 0 };
        }
    } finally {
        await client.disconnect();
    }
}

export function buildApp(): express.Application {
    const app = express();
    app.use(json());
    app.post("/reset", async (req, res) => {
        try {
            const account = req.body.account ?? "account";
            await reset(account);
            console.log(`Successfully reset account ${account}`);
            res.sendStatus(204);
        } catch (e) {
            console.error("Error while resetting account", e);
            res.status(500).json({ error: String(e) });
        }
    });
    app.post("/charge", async (req, res) => {
        try {
            const account = req.body.account ?? "account";
            const result = await charge(account, req.body.charges ?? 10);
            console.log(`Successfully charged account ${account}`);
            res.status(200).json(result);
        } catch (e) {
            console.error("Error while charging account", e);
            res.status(500).json({ error: String(e) });
        }
    });
    return app;
}
