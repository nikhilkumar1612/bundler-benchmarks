import { createFreeBundler } from "@etherspot/free-bundler";
import { privateKeyToAccount, generatePrivateKey } from "viem/accounts";
import {
    Call,
    Chain,
    Hex,
    parseUnits,
    Prettify,
    PrivateKeyAccount,
    publicActions,
    SignAuthorizationReturnType,
    walletActions
} from "viem";
import { optimism } from "viem/chains";
import { appendFileSync } from "fs";
import dotenv from "dotenv";
import {
    GetUserOperationReceiptReturnType,
    GetUserOperationReturnType,
    toSimple7702SmartAccount
} from "viem/account-abstraction";
dotenv.config();

export function sleep(sec: number): Promise<void> {
    return new Promise<void>((resolve) => setTimeout(resolve, sec * 1000));
}

const setupAccounts = async (n: number) => {
    const accounts: PrivateKeyAccount[] = [];
    const timestamp = Date.now();
    const filename = `output_${timestamp}.txt`;
    for (let i = 0; i < n; i++) {
        const privateKey = generatePrivateKey();
        const account = privateKeyToAccount(privateKey as Hex);
        appendFileSync(filename, `${privateKey}-${account.address}\n`);
        accounts.push(account);
    }
    return accounts;
};

const fundAccounts = async (accounts: PrivateKeyAccount[], owner: PrivateKeyAccount) => {
    const bundlerClient = createFreeBundler({
        chain: optimism,
        bundlerUrl: process.env.BUNDLER_URL
    }).extend(walletActions).extend(publicActions);

    const smartAccount = await toSimple7702SmartAccount({
        client: bundlerClient,
        owner
    });

     // check sender's code to decide if eip7702Auth tuple is necessary for userOp.
     const senderCode = await bundlerClient.getCode({
        address: smartAccount.address
    });

    let authorization: SignAuthorizationReturnType | undefined;
    const { address: delegateAddress } = smartAccount.authorization;

    if(senderCode !== `0xef0100${delegateAddress.toLowerCase().substring(2)}`) {
        authorization = await bundlerClient.signAuthorization(smartAccount.authorization)
    }
    const calls: Prettify<Call>[] = [];
    for(const account of accounts) {
        calls.push({
            to: account.address,
            value: parseUnits('0.0001', 18),
        })
    }

    for(let i=0; i<accounts.length; i+=5) {
        const userOpHash = await bundlerClient.sendUserOperation({
            account: smartAccount,
            authorization,
            calls: calls.slice(i, i+5 > accounts.length ? accounts.length : i+5)
        });
        console.log("\n\n\n");
        console.log("userop hash:: ", userOpHash);

        // wait for tx receipt
        const timeout = Date.now() + 60000;
        let txReceipt: GetUserOperationReceiptReturnType | null = null;
        while(!txReceipt && (Date.now() < timeout)) {
            txReceipt = await bundlerClient.getUserOperationReceipt({ hash: userOpHash });
            await sleep(2);
        }
        console.log("txReceipt:: ", txReceipt?.receipt.transactionHash);
    }
}

const sendUserop = async (
    owner: PrivateKeyAccount
) => {
    const bundlerClient = createFreeBundler({
        chain: optimism,
        bundlerUrl: process.env.BUNDLER_URL
    }).extend(walletActions).extend(publicActions);

    const smartAccount = await toSimple7702SmartAccount({
        client: bundlerClient,
        owner
    });

     // check sender's code to decide if eip7702Auth tuple is necessary for userOp.
     const senderCode = await bundlerClient.getCode({
        address: smartAccount.address
    });

    let authorization: SignAuthorizationReturnType | undefined;
    const { address: delegateAddress } = smartAccount.authorization;

    if(senderCode !== `0xef0100${delegateAddress.toLowerCase().substring(2)}`) {
        authorization = await bundlerClient.signAuthorization(smartAccount.authorization)
    }

    const startTime = Date.now();
    const userop = await bundlerClient.sendUserOperation({
        account: smartAccount,
        authorization,
        calls: [{
            to: "0x09FD4F6088f2025427AB1e89257A44747081Ed59",
            value: parseUnits("0.00000001", 18)
        }]
    });

    console.log("userop:: ", userop);
    console.log("time taken to estimate and send userop::", Date.now() - startTime, "ms")
    return {userop, bundlerClient};
}

const main = async (
    chain: Chain,
    type: "setupAccounts" | "measureReceipt" | "measureP2pPropagation"
) => {
    if(type === "setupAccounts") {
        const owner = privateKeyToAccount(process.env.PRIVATE_KEY! as Hex);
        const accounts = await setupAccounts(Number(process.env.NUMBER_OF_ACCOUNTS) || 2);
        await fundAccounts(accounts, owner);
        return;
    }
    const pvtKeys: Hex[] = process.env.ACCOUNTS!.split(",") as Hex[];
    for(const pvtKey of pvtKeys) {
        const account = privateKeyToAccount(pvtKey);
        const start = Date.now();
        console.log("\n-----------------------------------------------------------------");
        const { bundlerClient, userop } = await sendUserop(account);
        console.log("Time taken to prepare and send userop:: ", Date.now() - start, "ms");
        
        const timeout = Date.now() + 60000;
        // wait for tx receipt
        if(type === "measureReceipt") {
            let txReceipt: GetUserOperationReceiptReturnType | null = null;
            const receiptTimer = Date.now();
            while(!txReceipt && (Date.now() < timeout)) {
                txReceipt = await bundlerClient.getUserOperationReceipt({ hash: userop }).catch((err) => {
                    // console.log("error: ", err);
                    return null;
                });
            }
            console.log("txReceipt:: ", txReceipt?.receipt.transactionHash);
            console.log(
                "Time taken for userop to reach onchain after saved to mempool: ",
                Date.now() - receiptTimer,
                "ms"
            );
            console.log("-----------------------------------------------------------------\n");
        } else {// wait for p2p propagation.
            const client = createFreeBundler({chain, bundlerUrl: process.env.BUNDLER_URL});
            let useropDetails: GetUserOperationReturnType | null = null;
            const timer = Date.now();
            while(!useropDetails && (Date.now() < timeout)) {
                useropDetails = await client.getUserOperation({hash: userop}).catch((err) => {
                    // console.log("error: ", err);
                    return null;
                });
            }
            console.log(
                "Time taken to propagate userop to other nodes: ",
                Date.now() - timer,
                "ms"
            );
            console.log("-----------------------------------------------------------------\n");
        }
    }
    return;
};

main(optimism, "measureP2pPropagation");
