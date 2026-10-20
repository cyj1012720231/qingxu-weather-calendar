import { weatherConfiguration, weatherService } from '../../../lib/weather-service';
import { rateLimit, requestRateLimitKey, errorResponse } from '../../../lib/qweather-server';
export const runtime='nodejs';
export const dynamic='force-dynamic';
export async function GET(request:Request){
 try{
  const check=new URL(request.url).searchParams.get('check')==='1';
  if(check)rateLimit(requestRateLimitKey(request.headers));
  return Response.json(check?await weatherService.check():weatherConfiguration(),{headers:{'Cache-Control':'no-store'}});
 }catch(error){return errorResponse(error);}
}
