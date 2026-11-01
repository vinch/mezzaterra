import { loadTasting } from "$lib/publicData";
import type { PageLoad } from "./$types";

export const load: PageLoad = ({ params }) => loadTasting(params.id);
