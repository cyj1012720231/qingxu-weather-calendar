import { weatherService } from '../../../lib/weather-service';
import { weatherPath, rateLimit, requestRateLimitKey, errorResponse } from '../../../lib/qweather-server';
export const runtime='nodejs';
export const dynamic='force-dynamic';
export async function GET(request:Request){
 try{const path=weatherPath(new URL(request.url).searchParams);rateLimit(requestRateLimitKey(request.headers));return Response.json(await weatherService.get(path),{headers:{'Cache-Control':'private, no-store'}});}catch(e){return errorResponse(e);}
}
