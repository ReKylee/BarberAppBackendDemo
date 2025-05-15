import { Request, Response, NextFunction } from "express";

// Debug middleware to log request details
export function debugMiddleware(
    req: Request,
    res: Response,
    next: NextFunction
): void {
    console.log("==== DEBUG ====");
    console.log("Request path:", req.path);
    console.log("Request method:", req.method);
    console.log("Request body:", JSON.stringify(req.body, null, 2));
    console.log("Request params:", JSON.stringify(req.params, null, 2));
    console.log("Request query:", JSON.stringify(req.query, null, 2));

    // Create a proxy for the response to capture the status code
    const originalSend = res.send;
    res.send = function (body) {
        console.log("Response status:", res.statusCode);
        console.log("Response body:", body);
        console.log("==== END DEBUG ====");
        return originalSend.call(this, body);
    };
    next();
}

export function enhancedDebugMiddleware(
    req: Request,
    res: Response,
    next: NextFunction
): void {
    console.log("==== PRE-ROUTE DEBUG ====");
    console.log("Request path:", req.path);
    console.log("Request method:", req.method);
    console.log("Request body:", JSON.stringify(req.body, null, 2));
    console.log(
        "Request params (pre-route):",
        JSON.stringify(req.params, null, 2)
    );
    console.log(
        "Request query (pre-route):",
        JSON.stringify(req.query, null, 2)
    );

    // Store the original send method
    const originalSend = res.send;

    // Override send to log after route matching
    res.send = function (body) {
        console.log("==== POST-ROUTE DEBUG ====");
        console.log(
            "Request params (post-route):",
            JSON.stringify(req.params, null, 2)
        );
        console.log(
            "Request query (post-route):",
            JSON.stringify(req.query, null, 2)
        );
        console.log("Response status:", res.statusCode);
        console.log("Response body:", body);
        console.log("==== END DEBUG ====");

        return originalSend.call(this, body);
    };

    next();
}
