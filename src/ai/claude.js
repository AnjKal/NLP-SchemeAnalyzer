"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __generator = (this && this.__generator) || function (thisArg, body) {
    var _ = { label: 0, sent: function() { if (t[0] & 1) throw t[1]; return t[1]; }, trys: [], ops: [] }, f, y, t, g = Object.create((typeof Iterator === "function" ? Iterator : Object).prototype);
    return g.next = verb(0), g["throw"] = verb(1), g["return"] = verb(2), typeof Symbol === "function" && (g[Symbol.iterator] = function() { return this; }), g;
    function verb(n) { return function (v) { return step([n, v]); }; }
    function step(op) {
        if (f) throw new TypeError("Generator is already executing.");
        while (g && (g = 0, op[0] && (_ = 0)), _) try {
            if (f = 1, y && (t = op[0] & 2 ? y["return"] : op[0] ? y["throw"] || ((t = y["return"]) && t.call(y), 0) : y.next) && !(t = t.call(y, op[1])).done) return t;
            if (y = 0, t) op = [op[0] & 2, t.value];
            switch (op[0]) {
                case 0: case 1: t = op; break;
                case 4: _.label++; return { value: op[1], done: false };
                case 5: _.label++; y = op[1]; op = [0]; continue;
                case 7: op = _.ops.pop(); _.trys.pop(); continue;
                default:
                    if (!(t = _.trys, t = t.length > 0 && t[t.length - 1]) && (op[0] === 6 || op[0] === 2)) { _ = 0; continue; }
                    if (op[0] === 3 && (!t || (op[1] > t[0] && op[1] < t[3]))) { _.label = op[1]; break; }
                    if (op[0] === 6 && _.label < t[1]) { _.label = t[1]; t = op; break; }
                    if (t && _.label < t[2]) { _.label = t[2]; _.ops.push(op); break; }
                    if (t[2]) _.ops.pop();
                    _.trys.pop(); continue;
            }
            op = body.call(thisArg, _);
        } catch (e) { op = [6, e]; y = 0; } finally { f = t = 0; }
        if (op[0] & 5) throw op[1]; return { value: op[0] ? op[1] : void 0, done: true };
    }
};
var _a, _b;
Object.defineProperty(exports, "__esModule", { value: true });
exports.claudeText = claudeText;
exports.safeJsonParse = safeJsonParse;
var client_bedrock_runtime_1 = require("@aws-sdk/client-bedrock-runtime");
var region = ((_a = process.env.AWS_REGION) !== null && _a !== void 0 ? _a : 'us-east-1').trim();
var modelId = ((_b = process.env.BEDROCK_MODEL_ID) !== null && _b !== void 0 ? _b : 'anthropic.claude-3-5-sonnet-20240620-v1:0').trim();
console.log('[claude] module loaded — region:', region, '— modelId:', modelId);
console.log('[claude] AWS_ACCESS_KEY_ID:', process.env.AWS_ACCESS_KEY_ID ? 'SET (' + process.env.AWS_ACCESS_KEY_ID.trim().slice(0, 8) + '...)' : 'NOT SET');
console.log('[claude] AWS_SECRET_ACCESS_KEY:', process.env.AWS_SECRET_ACCESS_KEY ? 'SET' : 'NOT SET');
var bedrockRuntime = new client_bedrock_runtime_1.BedrockRuntimeClient({ region: region });
console.log('[claude] BedrockRuntimeClient initialized');
function claudeText(prompt_1) {
    return __awaiter(this, arguments, void 0, function (prompt, options) {
        var messages, inferenceConfig, commandInput, command, response, err_1, contentBlocks, text;
        var _a, _b, _c, _d, _e, _f, _g, _h, _j, _k;
        if (options === void 0) { options = {}; }
        return __generator(this, function (_l) {
            switch (_l.label) {
                case 0:
                    console.log('[claude:claudeText] called — modelId:', modelId, '— prompt length:', prompt.length, '— maxTokens:', (_a = options.maxTokens) !== null && _a !== void 0 ? _a : 4096, '— temperature:', (_b = options.temperature) !== null && _b !== void 0 ? _b : 0.2);
                    messages = [
                        {
                            role: "user",
                            content: [{ text: prompt }],
                        },
                    ];
                    inferenceConfig = {
                        maxTokens: (_c = options.maxTokens) !== null && _c !== void 0 ? _c : 4096,
                        temperature: (_d = options.temperature) !== null && _d !== void 0 ? _d : 0.2,
                    };
                    commandInput = {
                        modelId: modelId,
                        messages: messages,
                        inferenceConfig: inferenceConfig,
                    };
                    // Only add system if provided
                    if (options.system) {
                        commandInput.system = [{ text: options.system }];
                    }
                    command = new client_bedrock_runtime_1.ConverseCommand(commandInput);
                    console.log('[claude:claudeText] sending ConverseCommand to Bedrock...');
                    console.log('[claude:claudeText] using region:', region, '— modelId:', modelId);
                    _l.label = 1;
                case 1:
                    _l.trys.push([1, 3, , 4]);
                    return [4 /*yield*/, bedrockRuntime.send(command)];
                case 2:
                    response = _l.sent();
                    console.log('[claude:claudeText] Bedrock response received — stopReason:', response.stopReason, '— usage:', JSON.stringify(response.usage));
                    return [3 /*break*/, 4];
                case 3:
                    err_1 = _l.sent();
                    console.error('[claude:claudeText] Bedrock ConverseCommand FAILED');
                    console.error('[claude:claudeText]   error name    :', err_1 === null || err_1 === void 0 ? void 0 : err_1.name);
                    console.error('[claude:claudeText]   error code    :', (_e = err_1 === null || err_1 === void 0 ? void 0 : err_1.Code) !== null && _e !== void 0 ? _e : (_f = err_1 === null || err_1 === void 0 ? void 0 : err_1.$metadata) === null || _f === void 0 ? void 0 : _f.httpStatusCode);
                    console.error('[claude:claudeText]   http status   :', (_g = err_1 === null || err_1 === void 0 ? void 0 : err_1.$metadata) === null || _g === void 0 ? void 0 : _g.httpStatusCode);
                    console.error('[claude:claudeText]   message       :', err_1 === null || err_1 === void 0 ? void 0 : err_1.message);
                    console.error('[claude:claudeText]   full error    :', JSON.stringify(err_1, Object.getOwnPropertyNames(err_1)));
                    throw err_1;
                case 4:
                    contentBlocks = (_k = (_j = (_h = response.output) === null || _h === void 0 ? void 0 : _h.message) === null || _j === void 0 ? void 0 : _j.content) !== null && _k !== void 0 ? _k : [];
                    console.log('[claude:claudeText] contentBlocks count:', contentBlocks.length);
                    text = contentBlocks
                        .map(function (block) { return ("text" in block ? block.text : ""); })
                        .join("")
                        .trim();
                    console.log('[claude:claudeText] extracted text length:', text.length, '— preview:', text.slice(0, 200));
                    return [2 /*return*/, text];
            }
        });
    });
}
function safeJsonParse(text) {
    console.log('[claude:safeJsonParse] called — input length:', text.length);
    // Clean the text first - remove control characters and fix common issues
    var cleanedText = text
        .replace(/[\u0000-\u001F\u007F-\u009F]/g, '') // Remove control characters
        .trim();
    try {
        var result = JSON.parse(cleanedText);
        console.log('[claude:safeJsonParse] direct JSON.parse succeeded');
        return result;
    }
    catch (_a) {
        console.warn('[claude:safeJsonParse] direct parse failed, trying to extract JSON from response...');
        // Try extracting the first JSON object/array from the response.
        var firstBrace = cleanedText.indexOf("{");
        var lastBrace = cleanedText.lastIndexOf("}");
        if (firstBrace !== -1 && lastBrace !== -1 && lastBrace > firstBrace) {
            var candidate = cleanedText.slice(firstBrace, lastBrace + 1);
            console.log('[claude:safeJsonParse] trying object extraction — candidate length:', candidate.length);
            var result = JSON.parse(candidate);
            console.log('[claude:safeJsonParse] object extraction succeeded');
            return result;
        }
        var firstBracket = cleanedText.indexOf("[");
        var lastBracket = cleanedText.lastIndexOf("]");
        if (firstBracket !== -1 && lastBracket !== -1 && lastBracket > firstBracket) {
            var candidate = cleanedText.slice(firstBracket, lastBracket + 1);
            console.log('[claude:safeJsonParse] trying array extraction — candidate length:', candidate.length);
            var result = JSON.parse(candidate);
            console.log('[claude:safeJsonParse] array extraction succeeded');
            return result;
        }
        console.error('[claude:safeJsonParse] all parse attempts failed — raw text preview:', cleanedText.slice(0, 500));
        throw new Error("Model response was not valid JSON");
    }
}
