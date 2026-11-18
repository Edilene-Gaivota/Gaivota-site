// Keep legacy links working while making the new Pages hostname canonical.
export function onRequest(context) {
  const requestUrl = new URL(context.request.url);
  if (requestUrl.hostname === "gaivota-regularizacao-obras.pages.dev") {
    requestUrl.hostname = "gaivota-consultoria-contabil.pages.dev";
    requestUrl.protocol = "https:";
    return Response.redirect(requestUrl.toString(), 301);
  }
  return context.next();
}
