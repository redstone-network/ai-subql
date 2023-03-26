import {
  SubstrateExtrinsic,
  SubstrateEvent,
  SubstrateBlock,
} from "@subql/types";
import { Block } from "../types";
import { Balance } from "@polkadot/types/interfaces";

export async function handleBlock(block: SubstrateBlock): Promise<void> {
  //Create a new Block with ID using block hash
  let record = new Block(block.block.header.hash.toString());
  //Record block number
  record.blockhigh = block.block.header.number.toNumber();
  await record.save();
}