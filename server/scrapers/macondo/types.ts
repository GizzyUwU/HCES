import { t } from "elysia";
import { Nullable, Nullish } from "@server/scrapers/typeUtils";

export namespace MCTypes {
  export const GetProjectParams = t.Object({
    id: t.String({
      description: "Project ID",
    }),
  });

  export const GetProjectResponse = t.Object({
    id: Nullish(t.String()),
    user_id: Nullish(t.String()),
    name: Nullish(t.String()),
    type: Nullish(t.String()),
    description: Nullish(t.String()),
    fruit: Nullish(t.String()),
    level: Nullish(t.Number()),
    stage: Nullish(t.String()),
    demo_url: Nullish(t.String()),
    thumbnail_url: Nullish(t.String()),
    repository_url: Nullish(t.String()),
    hackatime_projects: Nullish(t.Array(t.String())),
    is_fork: Nullish(t.Boolean()),
    guide: Nullish(t.String()),
    html_content: Nullish(t.String()),
    css_content: Nullish(t.String()),
    readme_content: Nullish(t.String()),
    last_html_sha: Nullish(t.String()),
    last_css_sha: Nullish(t.String()),
    invite_code: Nullish(t.String()),
    project_streak_days: Nullish(t.Number()),
    last_worked_date: Nullish(t.String()),
    auto_use_streak_freezes: Nullish(t.Boolean()),
    cart_screenshots: Nullish(t.Array(t.Unknown())),
    build_cost_cents: Nullish(t.Number()),
    next_ship_needs_funding: Nullish(t.Boolean()),
    next_ship_is_build_complete: Nullish(t.Boolean()),
    next_ship_used_ai: Nullish(t.Boolean()),
    next_ship_ai_usage_description: Nullish(t.String()),
    next_ship_is_update: Nullish(t.Boolean()),
    next_ship_update_description: Nullish(t.String()),
    next_ship_reviewer_note: Nullish(t.String()),
    deleted_at: Nullish(t.String()),
    created_at: Nullish(t.String()),
    updated_at: Nullish(t.String()),
    owner: Nullish(t.Unknown()),
    journals: Nullish(t.Array(t.Unknown())),
    viewer_is_owner: Nullish(t.Boolean()),
    viewer_can_edit: Nullish(t.Boolean()),
    activeShip: Nullish(t.Unknown()),
    needsChangesShip: Nullish(t.Unknown()),
    latestActiveGrant: Nullish(t.Unknown()),
    has_active_grant: Nullish(t.Boolean()),
    hasPreviousShippedShip: Nullish(t.Boolean()),
    permRejected: Nullish(t.Boolean()),
    is_extra_fruity: Nullish(t.Boolean()),
    pendingFruit: Nullish(t.Number()),
    previousShippedHackatimeHours: Nullish(t.Number()),
    unshippedJournalHours: Nullish(t.Number()),
    streakStatus: Nullish(t.Unknown()),
  });

  export const GetUserParams = t.Object({
    id: t.String({
      description: "User ID",
    }),
  });

  export const GetUserResponse = t.Object({
    id: Nullish(t.String()),
    username: Nullish(t.String()),
    image: Nullish(t.String()),
    slack_id: Nullish(t.String()),
    created_at: Nullish(t.String()),
    last_active_date: Nullish(t.String()),
    project_count: Nullish(t.Number()),
    total_upvotes: Nullish(t.Number()),
    top_streak_days: Nullish(t.Number()),
    projects: Nullish(t.Array(t.Unknown())),
  });

  export const Journal = t.Object({
    id: t.Number(),
    short_brief: Nullable(t.String()),
    long_brief: Nullable(t.String()),
    hours: Nullable(t.Number()),
    created_at: Nullable(t.String({ format: "date-time" })),
    archived: Nullable(t.Boolean()),
    archived_at: Nullable(t.String()),
    content_language: Nullable(t.String()),
    author_id: Nullable(t.String()),
    author_username: Nullable(t.String()),
    author_slack_id: Nullable(t.String()),
    author_image: Nullable(t.String()),
  });

  export const JournalsResponse = t.Array(Journal);

  export const JournalsParams = t.Object({
    id: t.String({
      description: "Project ID",
    }),
  });

  export const HackatimeBreakdownResponse = t.Object({
    hackatimeBreakdown: Nullish(
      t.Array(
        t.Object({
          name: Nullish(t.String()),
          hours: Nullish(t.Number()),
        })
      )
    ),
    contributors: Nullish(
      t.Array(
        t.Object({
          user_id: Nullish(t.String()),
          username: Nullish(t.String()),
          slack_id: Nullish(t.String()),
          image: Nullish(t.String()),
          is_owner: Nullish(t.Boolean()),
          is_self: Nullish(t.Boolean()),
          projects: Nullish(
            t.Array(
              t.Object({
                name: Nullish(t.String()),
                hours: Nullish(t.Number()),
              })
            )
          ),
        })
      )
    ),
  });

  export const ShopItem = t.Object({
    id: t.String(),
    slug: Nullable(t.String()),
    name: Nullable(t.String()),
    description: Nullable(t.String()),
    image_url: Nullable(t.String()),
    price_hours: Nullable(t.Number()),
    price_fruit_type: Nullable(t.String()),
    price_fruit_amount: Nullable(t.Number()),
    stock_remaining: Nullable(t.Number()),
    available: Nullable(t.Boolean()),
    is_purchasable: Nullable(t.Boolean()),
    is_sold_out: Nullable(t.Boolean()),
    category: Nullable(t.String()),
    kind: Nullable(t.String()),
    created_at: Nullable(t.String()),
    updated_at: Nullable(t.String()),
    price_gold: Nullable(t.Number()),
    regionsEnabled: Nullable(t.Record(t.String(), t.Boolean())),
  });

  export const ShopItems = t.Array(ShopItem);

  export const Order = t.Object({
    id: Nullish(t.String()),
    user_id: Nullish(t.String()),
    item_id: Nullish(t.String()),
    quantity: Nullish(t.Number()),
    status: Nullish(t.String()),
    item_snapshot: Nullish(t.Unknown()),
    selected_modifiers: Nullish(t.Unknown()),
    shipping_address: Nullish(t.String()),
    phone: Nullish(t.String()),
    fulfillment_note: Nullish(t.String()),
    tracking_number: Nullish(t.String()),
    external_reference: Nullish(t.String()),
    fulfillment_error: Nullish(t.String()),
    address_encrypted: Nullish(t.String()),
    region: Nullish(t.String()),
    created_at: Nullish(t.String()),
    updated_at: Nullish(t.String()),
    total_price_gold: Nullish(t.Number()),
  });

  export const OrderItem = t.Object({
    id: Nullish(t.String()),
    slug: Nullish(t.String()),
    name: Nullish(t.String()),
    description: Nullish(t.String()),
    name_translations: Nullish(t.Record(t.String(), t.String())),
    description_translations: Nullish(t.Record(t.String(), t.String())),
    price_hours: Nullish(t.Number()),
    price_fruit_type: Nullish(t.String()),
    price_fruit_amount: Nullish(t.Number()),
    price_fruit_level: Nullish(t.Unknown()),
    price_fruit_category: Nullish(t.Unknown()),
    image_url: Nullish(t.String()),
    kind: Nullish(t.String()),
    fulfillment_provider: Nullish(t.String()),
    source: Nullish(t.String()),
    grant_amount_cents: Nullish(t.Number()),
    attachment_urls: Nullish(t.Array(t.Unknown())),
    inventory_mode: Nullish(t.String()),
    stock_remaining: Nullish(t.Number()),
    max_per_user: Nullish(t.Number()),
    sale_price_hours: Nullish(t.Number()),
    available_until: Nullish(t.String()),
    available: Nullish(t.Boolean()),
    coming_soon: Nullish(t.Boolean()),
    requires_shipped_project: Nullish(t.Boolean()),
    pinned: Nullish(t.Boolean()),
    extra_fruity: Nullish(t.Boolean()),
    priority_eligible: Nullish(t.Boolean()),
    regional_pricing: Nullish(t.Record(t.String(), t.Unknown())),
    modifiers: Nullish(t.Unknown()),
    category: Nullish(t.String()),
    created_at: Nullish(t.String()),
    updated_at: Nullish(t.String()),
    price_gold: Nullish(t.Number()),
    regular_price_hours: Nullish(t.Number()),
    regular_price_gold: Nullish(t.Number()),
    is_on_sale: Nullish(t.Boolean()),
    is_expired: Nullish(t.Boolean()),
    is_sold_out: Nullish(t.Boolean()),
    is_purchasable: Nullish(t.Boolean()),
    available_in_region: Nullish(t.Boolean()),
    resolved_region: Nullish(t.String()),
    user_has_unlocked: Nullish(t.Boolean()),
  });

  export const OrderUser = t.Object({
    id: Nullish(t.String()),
    name: Nullish(t.String()),
    email: Nullish(t.String()),
    hcb_email: Nullish(t.String()),
  });

  export const MyOrder = t.Object({
    order: Nullish(Order),
    item: Nullish(OrderItem),
    orderUser: Nullish(OrderUser),
    fulfillable: Nullish(t.Boolean()),
  });

  export const MyOrders = t.Array(MyOrder);

  export const OgParams = t.Object({
    id: t.String(),
  });

  export const OgResponse = t.Object({
    name: Nullish(t.String()),
    ownerName: Nullish(t.String()),
    ownerImage: Nullish(t.String()),
    type: Nullish(t.String()),
    hours: Nullish(t.Number()),
    hasThumbnail: Nullish(t.Boolean()),
    thumbnailUrl: Nullish(t.String()),
  });

  export const StreaksProject = t.Object({
    id: Nullish(t.Number()),
    name: Nullish(t.String()),
    project_streak_days: Nullish(t.Number()),
    last_worked_date: Nullish(t.String()),
    worked_today: Nullish(t.Boolean()),
    auto_use_streak_freezes: Nullish(t.Boolean()),
  });

  export const StreaksResponse = t.Object({
    current_streak: Nullish(t.Number()),
    streak_freezes_remaining: Nullish(t.Number()),
    worked_today: Nullish(t.Boolean()),
    today_seconds_logged: Nullish(t.Number()),
    daily_goal_seconds: Nullish(t.Number()),
    projects: Nullish(t.Array(StreaksProject)),
  });
  export const BalanceResponse = t.Unknown();
  export const StarfruitResponse = t.Unknown();
  export const EarningRateResponse = t.Unknown();
  export const AchievementsResponse = t.Unknown();
  export const NotificationsResponse = t.Unknown();
}
