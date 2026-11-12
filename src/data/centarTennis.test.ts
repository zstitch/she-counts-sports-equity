import {test,expect} from "vitest";import {computeKpis} from "@/data/sportsData";
test("centar",()=>{const k=computeKpis("centar-tennis");expect([k.femaleShare,k.dropoutRisk,k.coachShare,k.worstAge.age]).toEqual([34,31,22,"U16"]);});
