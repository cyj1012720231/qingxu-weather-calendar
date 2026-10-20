import { weatherService } from '../../../lib/weather-service';
import { geoPath, rateLimit, errorResponse } from '../../../lib/qweather-server';
export const dynamic='force-dynamic';
export async function GET(request:Request){
 try{const path=geoPath(new URL(request.url).searchParams);rateLimit(request.headers.get('oai-authenticated-user-id')??request.headers.get('cf-connecting-ip')??'local');return Response.json(await weatherService.get(path),{headers:{'Cache-Control':'private, no-store'}});}catch(e){return errorResponse(e);}
}
