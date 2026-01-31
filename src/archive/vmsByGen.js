import { vms_gen1 } from "../vms/vms_gen1";
import { vms_gen2 } from "../vms/vms_gen2";
import { vms_gen3 } from "../vms/vms_gen3";
import { vms_gen4 } from "../vms/vms_gen4";
import { vms_gen5 } from "../vms/vms_gen5";
import { vms_gen6 } from "../vms/vms_gen6";
import { vms_gen32 } from "../vms/vms_gen32";
import { vms_gen42 } from "../vms/vms_gen42";
import { vms_gen52 } from "../vms/vms_gen52";
import { vms_gen62 } from "../vms/vms_gen62";


const vmsByGen = {
  1: vms_gen1,
  2: vms_gen2,
  3: vms_gen3,
  4: vms_gen4,
  5: vms_gen5,
  6: vms_gen6,
  32: vms_gen32,
  42: vms_gen42,
  52: vms_gen52,
  62: vms_gen62,
};

export default vmsByGen;
