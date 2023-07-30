import { EventRecord } from "@polkadot/types/interfaces";
import { SubstrateExtrinsic, SubstrateBlock } from "@subql/types";
import { Block, Event, Extrinsic, Transfer } from "../types";


// let specVersion: SpecVersion;
export async function handleBlock(block: SubstrateBlock): Promise<void> {

  // Process all events in block
  const events = block.events
    .filter(
      (evt) =>
        !(evt.event.section === "system" &&
        evt.event.method === "ExtrinsicSuccess")
    )
    .map((evt, idx) =>
      handleEvent(block.block.header.number.toNumber(), idx, evt, block.timestamp)
    );

  // Process all calls in block
  const calls = wrapExtrinsics(block).map((ext, idx) =>
    handleCall(`${block.block.header.number.toString()}-${idx}`,
     idx,
     ext, 
     block.timestamp)
  );

  // Process all tranfer in block
  const isTranfer = (extrinsic: SubstrateExtrinsic, idx: number) => (extrinsic.extrinsic.method.section === "balances" && extrinsic.extrinsic.method.method === "transfer") && (extrinsic.extrinsic.method.section === "balances" && extrinsic.extrinsic.method.method === "transfer_keep_alive");
  const tranfers = wrapExtrinsics(block).filter(isTranfer).map((ext, idx) =>
    handleTransfer(`${block.block.header.number.toString()}-${idx}`,
     idx, 
     block.block.header.number.toNumber(),
     ext, 
     block.timestamp)
  );

  let b = new Block(
    block.block.header.number.toString(),
    block.block.header.number.toNumber(),
    block.block.hash.toString(),
    block.events.length,
    block.block.extrinsics.length,
  );
  await b.save();

  // Save all data
  await Promise.all([
    store.bulkCreate("Event", events),
    store.bulkCreate("Extrinsic", calls),
    store.bulkCreate("Transfer", tranfers),
  ]);
}

function handleEvent(
  blockNumber: number,
  eventIdx: number,
  event: EventRecord,
  timestamp: Date,
): Event {
  const newEvent = new Event(
    `${blockNumber}-${eventIdx}`,
    eventIdx,
    event.event.section,
    event.event.method,
    blockNumber,
    timestamp,
  );
  return newEvent;
}

function handleCall(idx: string,  extrinsicIdx: number, extrinsic: SubstrateExtrinsic, timestamp: Date,): Extrinsic {
  const newExtrinsic = new Extrinsic(
      idx,
      extrinsic.block.block.header.number.toNumber(),   
      extrinsicIdx,   
      extrinsic.extrinsic.method.section,
      extrinsic.extrinsic.method.method,
      extrinsic.extrinsic.nonce.toString(),      
      extrinsic.extrinsic.hash.toString(),
      timestamp,
      extrinsic.success,
  );
  return newExtrinsic;
}

function handleTransfer(idx: string,  blockNumber: number, extrinsicIdx: number, extrinsic: SubstrateExtrinsic, timestamp: Date,){
  let args = extrinsic.extrinsic.method.args;
  const newTransfer = new Transfer(
    idx,
    extrinsic.extrinsic.hash.toString(),
    blockNumber,
    extrinsicIdx,
    extrinsic.extrinsic.method.section,
    extrinsic.extrinsic.method.method,
    args[0].toString(),
    args[1].toString(),
    BigInt(args[2].toString()),
    "DOT",
    "native",
    timestamp,
  );
  return newTransfer;
}

function wrapExtrinsics(wrappedBlock: SubstrateBlock): SubstrateExtrinsic[] {
  return wrappedBlock.block.extrinsics.map((extrinsic, idx) => {
    const events = wrappedBlock.events.filter(
      ({ phase }) => phase.isApplyExtrinsic && phase.asApplyExtrinsic.eqn(idx)
    );
    return {
      idx,
      extrinsic,
      block: wrappedBlock,
      events,
      success:
        events.findIndex((evt) => evt.event.method === "ExtrinsicSuccess") > -1,
    };
  });
}