// Pages compara _redirects por ruta, no por host.
// Sin esto, www.jomstudio.site sirve el mismo HTML que el apex y no canoniza.

export async function onRequest(context) {
  const url = new URL(context.request.url);
  if (url.hostname === "www.jomstudio.site") {
    url.hostname = "jomstudio.site";
    return Response.redirect(url.toString(), 301);
  }
  return context.next();
}
