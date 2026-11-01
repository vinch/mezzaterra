import { loadTasting } from "$lib/publicData";
import { winesRevealed } from "$lib/dates";
import type { PageLoad } from "./$types";

export const load: PageLoad = ({ params }) => loadTasting(params.id, { reveal: winesRevealed });
