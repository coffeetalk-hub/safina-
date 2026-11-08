/**
 * Side-effect imports that register approval hooks, cron jobs, dashboard widgets and
 * the opening-balance poster. Imported once from the app layout and the cron route.
 */
import "./ar/invoices";
import "./ap/bills";
import "./ap/payments";
import "./assets/service";
import "./widgets";
import "@/modules/sales/register";
import "@/modules/purchasing/register";
import "@/modules/hr/register";
import { registerCronJob } from "@/core/cron";
import { registerOpeningPoster } from "@/modules/foundation/import/opening";
import { postOpeningBalancesJournal, runRecurring } from "./journals/service";

registerOpeningPoster(postOpeningBalancesJournal);
registerCronJob("recurring-journals", () => runRecurring(null, null));
