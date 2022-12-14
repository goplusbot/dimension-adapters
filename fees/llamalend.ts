import { Adapter } from "../adapters/types";
import { CHAIN } from "../helpers/chains";
import { request, gql } from "graphql-request";
import type { ChainEndpoints } from "../adapters/types"
import { Chain } from '@defillama/sdk/build/general';
import { getTimestampAtStartOfDayUTC } from "../utils/date";
import BigNumber from "bignumber.js";
import { getBlock } from "../helpers/getBlock";
import { getPrices } from "../utils/prices";

const endpoints = {
  [CHAIN.ETHEREUM]: "https://api.thegraph.com/subgraphs/name/0xngmi/llamalend",
}
const ONE_DAY_IN_SECONDS = 60 * 60 * 24

interface IGraph {
  interest: string;
  borrowed: string;
}
const graphs = (graphUrls: ChainEndpoints) => {
  return (chain: Chain) => {
    return async (timestamp: number) => {
      const todaysBlock = (await getBlock(timestamp, chain, {}));
      const graphQuery = gql
      `
      {
        loans(where:{owner_not: "0x0000000000000000000000000000000000000000"}, block:{ number: ${todaysBlock}}) {
          interest
          borrowed
        }
      }
      `;

      const graphRes:IGraph[]  = (await request(graphUrls[chain], graphQuery)).loans;
      const ethAddress = "ethereum:0x0000000000000000000000000000000000000000";
      const ethPrice = (await getPrices([ethAddress], timestamp))[ethAddress].price;
      const dailyFeePerSec = graphRes.reduce((a: number, b: IGraph ) => a + (Number(b.interest) * Number(b.borrowed)), 0)
      const dailyFee = dailyFeePerSec / 1e36 * ONE_DAY_IN_SECONDS * ethPrice;

      return {
        timestamp: timestamp,
        dailyFees: dailyFee.toString(),
      };
    };
  };
};


const adapter: Adapter = {
  adapter: {
    [CHAIN.ETHEREUM]: {
        fetch: graphs(endpoints)(CHAIN.ETHEREUM),
        start: async ()  => 1667260800,
    },
  }
}

export default adapter;
