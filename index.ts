import { createFreeBundler } from "@etherspot/free-bundler";
import { privateKeyToAccount, generatePrivateKey } from "viem/accounts";
import { Address, Call, Hex, parseUnits, Prettify, PrivateKeyAccount, publicActions, SignAuthorizationReturnType, walletActions } from "viem";
import { sepolia } from "viem/chains";
import { appendFileSync } from "fs";
import dotenv from "dotenv";
import { GetUserOperationReceiptReturnType, toSimple7702SmartAccount } from "viem/account-abstraction";
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
        chain: sepolia,
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
            value: parseUnits('0.001', 18),
        })
    }

    for(let i=0; i<accounts.length; i+=5) {
        const userOpHash = await bundlerClient.sendUserOperation({
            account: smartAccount,
            authorization,
            calls: calls.slice(i, i+5 > accounts.length ? accounts.length - i + 5 : i+5)
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

const main = async () => {
    const accounts = await setupAccounts(
        Number(process.env.NUMBER_OF_ACCOUNTS || 10)
    );
    console.log(accounts.length);
    const owner = privateKeyToAccount(process.env.PRIVATE_KEY! as Hex);

    // fund accounts
    await fundAccounts(accounts, owner);

    // send parallel userops
    return;
};

main();
