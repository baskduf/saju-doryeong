export type KakaoCardButton =
  | {
      action: "webLink";
      label: string;
      webLinkUrl: string;
    }
  | {
      action: "message";
      label: string;
      messageText: string;
    }
  | {
      action: "share";
      label: string;
    };

export type KakaoQuickReply = {
  label: string;
  action: "message";
  messageText: string;
};

export type KakaoBasicCardResponse = {
  version: "2.0";
  template: {
    outputs: Array<{
      basicCard: {
        title: string;
        description: string;
        thumbnail: {
          imageUrl: string;
        };
        buttons?: KakaoCardButton[];
      };
    }>;
    quickReplies: KakaoQuickReply[];
  };
};

export type KakaoProfileLike = {
  userId: string;
  name: string | null;
  birthDate: Date;
  birthTime: string | null;
  calendarType: string;
  sajuData: unknown;
};

export type KakaoActionParams = {
  hasAny: boolean;
  name?: string;
  birthDate?: string;
  birthTime?: string;
  calendarType?: string;
  debugLines: string[];
};

export type KakaoDispatchResult = {
  body: KakaoBasicCardResponse;
  status?: 200 | 401 | 500 | 503;
};
