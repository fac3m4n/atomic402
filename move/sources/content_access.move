/// x402 Content Access Module
/// Demonstrates atomic payment + access grant on Sui
module x402_content::content_access {
    use sui::coin::{Self, Coin};
    use sui::sui::SUI;
    use sui::event;

    // ===== Errors =====
    const EInsufficientPayment: u64 = 0;
    const EContentNotFound: u64 = 1;

    // ===== Objects =====

    /// Content Registry - stores all available premium content
    public struct ContentRegistry has key {
        id: UID,
        owner: address,
    }

    /// Individual Content Item
    public struct ContentItem has key, store {
        id: UID,
        title: vector<u8>,
        description: vector<u8>,
        price: u64,
        content_url: vector<u8>,
        creator: address,
    }

    /// Access Receipt NFT - proves payment and grants access
    /// This is the key innovation: minted atomically with payment
    public struct AccessReceipt has key, store {
        id: UID,
        content_id: ID,
        content_title: vector<u8>,
        price_paid: u64,
        purchaser: address,
        timestamp: u64,
    }

    // ===== Events =====

    public struct ContentCreated has copy, drop {
        content_id: ID,
        title: vector<u8>,
        price: u64,
        creator: address,
    }

    public struct ContentPurchased has copy, drop {
        content_id: ID,
        receipt_id: ID,
        purchaser: address,
        price_paid: u64,
        timestamp: u64,
    }

    // ===== Init =====

    fun init(ctx: &mut TxContext) {
        let registry = ContentRegistry {
            id: object::new(ctx),
            owner: ctx.sender(),
        };
        transfer::share_object(registry);
    }

    // ===== Public Functions =====

    /// Create new premium content
    public entry fun create_content(
        title: vector<u8>,
        description: vector<u8>,
        price: u64,
        content_url: vector<u8>,
        ctx: &mut TxContext
    ) {
        let content_id = object::new(ctx);
        let content_id_inner = object::uid_to_inner(&content_id);
        
        let content = ContentItem {
            id: content_id,
            title,
            description,
            price,
            content_url,
            creator: ctx.sender(),
        };

        event::emit(ContentCreated {
            content_id: content_id_inner,
            title: content.title,
            price,
            creator: ctx.sender(),
        });

        transfer::share_object(content);
    }

    /// THE KEY FUNCTION: Atomic payment + access grant
    /// This is what makes x402 on Sui special - no verification delay!
    public entry fun purchase_and_grant_access(
        content: &ContentItem,
        payment: Coin<SUI>,
        clock: &sui::clock::Clock,
        ctx: &mut TxContext
    ) {
        // Verify payment amount
        let price = content.price;
        assert!(coin::value(&payment) >= price, EInsufficientPayment);

        // Transfer payment to content creator (atomic!)
        transfer::public_transfer(payment, content.creator);

        // Mint access receipt NFT (atomic!)
        let receipt_id = object::new(ctx);
        let receipt_id_inner = object::uid_to_inner(&receipt_id);
        
        let receipt = AccessReceipt {
            id: receipt_id,
            content_id: object::id(content),
            content_title: content.title,
            price_paid: price,
            purchaser: ctx.sender(),
            timestamp: sui::clock::timestamp_ms(clock),
        };

        event::emit(ContentPurchased {
            content_id: object::id(content),
            receipt_id: receipt_id_inner,
            purchaser: ctx.sender(),
            price_paid: price,
            timestamp: sui::clock::timestamp_ms(clock),
        });

        // Transfer receipt to purchaser
        transfer::public_transfer(receipt, ctx.sender());
    }

    // ===== View Functions =====

    public fun get_content_price(content: &ContentItem): u64 {
        content.price
    }

    public fun get_content_title(content: &ContentItem): vector<u8> {
        content.title
    }

    public fun get_content_url(content: &ContentItem): vector<u8> {
        content.content_url
    }

    public fun get_content_creator(content: &ContentItem): address {
        content.creator
    }

    public fun get_receipt_content_id(receipt: &AccessReceipt): ID {
        receipt.content_id
    }

    public fun get_receipt_timestamp(receipt: &AccessReceipt): u64 {
        receipt.timestamp
    }

    // ===== Test Init =====
    
    #[test_only]
    public fun init_for_testing(ctx: &mut TxContext) {
        init(ctx);
    }
}

