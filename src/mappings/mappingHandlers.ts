import { EventRecord } from "@polkadot/types/interfaces";
import { SubstrateExtrinsic, SubstrateBlock, TypedEventRecord } from "@subql/types";
import { Block, Event, Extrinsic, Transfer } from "../types";
import { Codec } from '@polkadot/types-codec/types';

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
  const full_calls = wrapExtrinsics(block).map((ext, idx) =>
    handleCall(
     `${block.block.header.number.toString()}-${idx}`,
     idx,
     ext, 
     block.timestamp)
  );

  const calls = full_calls.map((c) => {
    return c[0]
  });

  let trs = [];
  for (var item of full_calls) {
    for (var tr of item[1]) {
      trs.push(tr);
    }
  }

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
    store.bulkCreate("Transfer", trs),
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

function handleCall(idx: string,  extrinsicIdx: number, extrinsic: SubstrateExtrinsic, timestamp: Date,): [Extrinsic, Transfer[]] {
  const tranfers = extrinsic.events
    .filter(
      (evt) =>
        (
          evt.event.section === "balances" &&
          evt.event.method === "Transfer"
        )
    ).map((evt, evt_index)  =>
    handleTransfer(
    `${idx}-${evt_index}`,
     extrinsic.block.block.header.number.toNumber(),
     extrinsicIdx, 
     extrinsic, 
     evt,
     timestamp)
  );

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

  return [newExtrinsic, tranfers];
}

function handleTransfer(
  idx: string,
  blockNumber: number,
  extrinsicIdx: number,
  extrinsic: SubstrateExtrinsic,
  event: TypedEventRecord<Codec[]>,
  timestamp: Date,){

  let args = extrinsic.extrinsic.method.args;
  const newTransfer = new Transfer(
    idx,
    extrinsic.extrinsic.hash.toString(),
    blockNumber,
    extrinsicIdx,
    extrinsic.extrinsic.method.section,
    extrinsic.extrinsic.method.method,
    event.event.data[0].toString(),
    event.event.data[1].toString(),
    event.event.data[2].toString(),
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