import { n as TSS_SERVER_FUNCTION, r as getServerFnById, t as createServerFn } from "./ssr.mjs";
import { i as string, n as number, r as object } from "../_libs/zod.mjs";
//#region node_modules/.nitro/vite/services/ssr/assets/server-tF-4LE4P.js
var createSsrRpc = (functionId) => {
	const url = "/_serverFn/" + functionId;
	const serverFnMeta = { id: functionId };
	const fn = async (...args) => {
		return (await getServerFnById(functionId, { origin: "server" }))(...args);
	};
	return Object.assign(fn, {
		url,
		serverFnMeta,
		[TSS_SERVER_FUNCTION]: true
	});
};
var StartSchema = object({
	url: string().min(8).max(500),
	maxPages: number().min(3).max(20)
});
var startAuditFn = createServerFn({ method: "POST" }).validator((data) => StartSchema.parse(data)).handler(createSsrRpc("20282c8a1ac1e164cf7041bbcae5c578018368e97989e8a82a9649103383880a"));
var getAuditFn = createServerFn({ method: "POST" }).validator((data) => object({ id: string() }).parse(data)).handler(createSsrRpc("b8de9a7f445dea5e45df254efdcdd327c0dccf307f215055fcd84f0e05617a06"));
var listAuditsFn = createServerFn({ method: "GET" }).handler(createSsrRpc("01e4c63addda9e2caab6a080ee7374bfaf35cfb14c278adb0584f7166af769e7"));
//#endregion
export { listAuditsFn as n, startAuditFn as r, getAuditFn as t };
