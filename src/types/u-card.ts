export type PlatformSupportStatus = 'supported' | 'conditional' | 'unsupported' | string;

export interface KycRequirements {
  idCard: '需要' | '不需要' | '待确认' | '二选一' | string;
  passport: '需要' | '不需要' | '待确认' | '二选一' | string;
  addressProof: '需要' | '不需要' | '待确认' | string;
  overseasPhone: '需要' | '不需要' | '待确认' | string;
  updatedAt: string;
  sourceName: string;
}

export interface UCardDetail {
  name: string;
  cashback?: string;
  annualFee?: string;
  cardFee?: string;
  depositFee?: string;
  statusNote?: string;
  kyc: string;
  applyUrl: string;
  cautions: string[];
  specs: [string, string][];
  platforms?: [string, PlatformSupportStatus][];
  status?: string;
  kycRequirements?: KycRequirements;
  inviteCode?: string;
  inviteUrl?: string;
  officialUrl?: string;
}

export interface UCardItem {
  slug: string;
  brand: string;
  net: 'Visa' | 'Mastercard' | 'Visa / Mastercard' | string;
  custody?: '自托管' | '托管' | '自托管（USDC 卡）/ 托管（EUR 卡）' | string;
  img: string;
  tags: string[];
  variantGroup?: string;
  variantLabel?: string;
  c1?: string;
  c2?: string;
  fg?: string;
  detail: UCardDetail;
}
