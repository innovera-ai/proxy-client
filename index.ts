import axios from "axios";
import {
    ChatCompletion,
    ChatCompletionCreateParamsNonStreaming,
    ChatCompletionMessageParam,
} from "openai/resources/index";

import dotenv from "dotenv";
import { decode, encode } from "gpt-tokenizer";
dotenv.config();

export type ProxyResponse = {
    status: "completed" | "failed" | "pending" | "processing";
    response: ChatCompletion | null | string;
    analytics: {
        duration?: number;
        cost?: number;
    }
}

let proxyURL = process.env.PROXY_URL;
let proxyKey = process.env.PROXY_KEY;
let environment = process.env.ENVIRONMENT;
let priority = process.env.PRIORITY;

if (!proxyURL) {
    console.error("Please provide a PROXY_URL environment variable");
    process.exit(1);
}
if (!proxyKey) {
    console.error("Please provide a PROXY_KEY environment variable");
    process.exit(1);
}
if (!environment) {
    console.error("Please provide a ENVIRONMENT environment variable");
    process.exit(1);
}
if (!priority) {
    console.error("Please provide a PRIORITY environment variable");
    process.exit(1);
}

const delay = async (ms: number) => {
    return new Promise((resolve) => setTimeout(resolve, ms));
};

const MAX_RETRIES = 600;
const DELAY = 500;

export async function requestChatGpt(
    params: ChatCompletionCreateParamsNonStreaming,
    name: string,
    description: string,
    timeout_ms?: number,
): Promise<ProxyResponse> {
    if (!timeout_ms) {
        console.warn("No timeout provided in proxy, using default timeout of 120000ms, please provide a timeout in milliseconds to avoid this warning.");
    }
    const resp = await axios.post(
        `${proxyURL}/chat/completions`,
        params,
        {
            headers: {
                "authorization": proxyKey,
                "service-priority": priority,
                "environment": environment,
                "name": name,
                "description": description,
                "innovera-timeout": timeout_ms ? timeout_ms.toString() : 120000,
            },
        },
    );

    const id = resp.data.id;
    let status = resp.data.status;

    let retries = 0;
    let delayDuration = DELAY;
    let data: ProxyResponse | undefined;
    while (status !== "completed" && retries < MAX_RETRIES) {
        await delay(delayDuration);
        retries++;

        let resp = await axios.get(`${proxyURL}/chat/completions/${id}`);
        status = resp.data.status;
        data = resp?.data as ProxyResponse;

        if (status === "failed") {
            throw new Error("Request failed: " + data?.response);
        }

        // console.log("Getting: ", resp.data);
        // console.log("Received data: ", data);
    }
    // If status is still not "completed" after maximum retries, throw an error
    if (status !== "completed") {
        throw new Error("Maximum retries reached, request is not completed.");
    }
    return data as ProxyResponse;
}

export function shrinkText(text: string, maxLength: number): string {
    const tokens = encode(text);
    if (tokens.length <= maxLength) {
        return text;
    }
    const newTokens = tokens.slice(0, maxLength);
    return decode(newTokens);
}

export type ChatResponse = ChatCompletion;

export type ChatMessage = ChatCompletionMessageParam;

export type ChatRequest = ChatCompletionCreateParamsNonStreaming;
