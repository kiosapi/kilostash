// /api/auth — Login & token verification
export async function onRequestPost(context) {
  const { request, env } = context;
  const body = await request.json();

  // Verify token
  if (body.token) {
    if (body.token === env.AUTH_PASSWORD) {
      return Response.json({ valid: true });
    }
    return new Response('Unauthorized', { status: 401 });
  }

  // Login with password
  if (body.password === env.AUTH_PASSWORD) {
    return Response.json({ token: env.AUTH_PASSWORD });
  }

  return new Response('Wrong password', { status: 401 });
}
