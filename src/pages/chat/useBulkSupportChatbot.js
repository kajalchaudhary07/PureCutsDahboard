import { useMemo, useReducer } from "react";
import {
  CHAT_COPY,
  DISCOUNT_RULES,
  FINAL_ACTIONS,
  PRODUCT_TYPE_OPTIONS,
  QUANTITY_OPTIONS,
  SUPPORT_RESPONSES,
  TOP_LEVEL_OPTIONS,
} from "./chatbotConfig";

const STEP = {
  AWAITING_START: "AWAITING_START",
  ROOT: "ROOT",
  PRODUCT_TYPE: "PRODUCT_TYPE",
  QUANTITY: "QUANTITY",
  SUPPORT: "SUPPORT",
  RESULT: "RESULT",
};

const makeMessage = (role, text) => ({
  id: `${role}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
  role,
  text,
});

const makeQuestionMessage = (text) => {
  return makeMessage("bot", text);
};

const createInitialState = () => ({
  step: STEP.AWAITING_START,
  messages: [makeMessage("bot", CHAT_COPY.startPrompt)],
  selections: {
    topic: "",
    productType: "",
    quantity: "",
  },
  currentOptions: [],
  activeQuestionId: "",
});

const formatDiscountMessage = (discount) => {
  return `You are eligible for ${discount}% discount`;
};

const formatSelectionLabel = (options, selectedId) => {
  const selected = options.find((item) => item.id === selectedId);
  return selected?.label || selectedId;
};

const getOptionSetByStep = (step) => {
  if (step === STEP.ROOT) return TOP_LEVEL_OPTIONS;
  if (step === STEP.PRODUCT_TYPE) return PRODUCT_TYPE_OPTIONS;
  if (step === STEP.QUANTITY) return QUANTITY_OPTIONS;
  if (step === STEP.RESULT || step === STEP.SUPPORT) return FINAL_ACTIONS;
  return [];
};

const reducer = (state, action) => {
  if (action.type === "RESET") {
    return createInitialState();
  }

  if (action.type === "USER_TEXT") {
    const text = String(action.text || "").trim();
    if (!text) return state;

    const nextMessages = [...state.messages, makeMessage("user", text)];

    if (state.step === STEP.AWAITING_START) {
      const welcomeQuestion = makeQuestionMessage(CHAT_COPY.welcome);
      return {
        ...state,
        step: STEP.ROOT,
        messages: [...nextMessages, welcomeQuestion],
        currentOptions: TOP_LEVEL_OPTIONS,
        activeQuestionId: welcomeQuestion.id,
      };
    }

    if (state.currentOptions.length > 0) {
      return {
        ...state,
        messages: [...nextMessages, makeMessage("bot", CHAT_COPY.chooseAvailableOption)],
      };
    }

    const restartQuestion = makeQuestionMessage(CHAT_COPY.welcome);
    return {
      ...state,
      step: STEP.ROOT,
      messages: [...nextMessages, restartQuestion],
      currentOptions: TOP_LEVEL_OPTIONS,
      activeQuestionId: restartQuestion.id,
    };
  }

  if (action.type === "CHOOSE_OPTION") {
    const { optionId } = action;
    const availableOptions = getOptionSetByStep(state.step);

    if (!availableOptions.some((item) => item.id === optionId)) {
      return state;
    }

    if (state.step === STEP.ROOT) {
      const nextMessages = [
        ...state.messages,
        makeMessage("user", formatSelectionLabel(TOP_LEVEL_OPTIONS, optionId)),
      ];

      if (optionId === "bulk-order-discount") {
        const questionMessage = makeQuestionMessage(CHAT_COPY.askProductType);
        return {
          ...state,
          step: STEP.PRODUCT_TYPE,
          messages: [...nextMessages, questionMessage],
          selections: { ...state.selections, topic: optionId },
          currentOptions: PRODUCT_TYPE_OPTIONS,
          activeQuestionId: questionMessage.id,
        };
      }

      const supportReply = SUPPORT_RESPONSES[optionId] || "Our team will assist you shortly.";
      const actionQuestion = makeQuestionMessage(CHAT_COPY.nextAction);
      return {
        ...state,
        step: STEP.SUPPORT,
        messages: [...nextMessages, makeMessage("bot", supportReply), actionQuestion],
        selections: { ...state.selections, topic: optionId },
        currentOptions: FINAL_ACTIONS,
        activeQuestionId: actionQuestion.id,
      };
    }

    if (state.step === STEP.PRODUCT_TYPE) {
      const quantityQuestion = makeQuestionMessage(CHAT_COPY.askQuantity);
      return {
        ...state,
        step: STEP.QUANTITY,
        messages: [
          ...state.messages,
          makeMessage("user", formatSelectionLabel(PRODUCT_TYPE_OPTIONS, optionId)),
          quantityQuestion,
        ],
        selections: { ...state.selections, productType: optionId },
        currentOptions: QUANTITY_OPTIONS,
        activeQuestionId: quantityQuestion.id,
      };
    }

    if (state.step === STEP.QUANTITY) {
      const rule = DISCOUNT_RULES[optionId];
      if (!rule) return state;

      const actionQuestion = makeQuestionMessage(CHAT_COPY.nextAction);

      const resultMessages = [
        ...state.messages,
        makeMessage("user", formatSelectionLabel(QUANTITY_OPTIONS, optionId)),
        makeMessage("bot", formatDiscountMessage(rule.discount)),
        makeMessage("bot", `Suggestion: ${rule.suggestion}`),
        actionQuestion,
      ];

      if (rule.suggestTalkToSales) {
        resultMessages.splice(
          resultMessages.length - 1,
          0,
          makeMessage("bot", "For this order size, talking to sales is recommended.")
        );
      }

      return {
        ...state,
        step: STEP.RESULT,
        messages: resultMessages,
        selections: { ...state.selections, quantity: optionId },
        currentOptions: FINAL_ACTIONS,
        activeQuestionId: actionQuestion.id,
      };
    }

    if ((state.step === STEP.RESULT || state.step === STEP.SUPPORT) && optionId === "talk-to-sales") {
      const restartQuestion = makeQuestionMessage("Anything else? Select another support option.");
      return {
        ...state,
        step: STEP.ROOT,
        messages: [
          ...state.messages,
          makeMessage("user", formatSelectionLabel(FINAL_ACTIONS, optionId)),
          makeMessage("bot", "Sales team has been notified. Expect a callback soon."),
          restartQuestion,
        ],
        currentOptions: TOP_LEVEL_OPTIONS,
        activeQuestionId: restartQuestion.id,
      };
    }

    if ((state.step === STEP.RESULT || state.step === STEP.SUPPORT) && optionId === "place-order") {
      const restartQuestion = makeQuestionMessage("Anything else? Select another support option.");
      return {
        ...state,
        step: STEP.ROOT,
        messages: [
          ...state.messages,
          makeMessage("user", formatSelectionLabel(FINAL_ACTIONS, optionId)),
          makeMessage("bot", "Great choice. Redirecting you to place your order."),
          restartQuestion,
        ],
        currentOptions: TOP_LEVEL_OPTIONS,
        activeQuestionId: restartQuestion.id,
      };
    }
  }

  return state;
};

export function useBulkSupportChatbot() {
  const [state, dispatch] = useReducer(reducer, undefined, createInitialState);

  const summary = useMemo(() => {
    return {
      topic: state.selections.topic,
      productType: state.selections.productType,
      quantity: state.selections.quantity,
      discount: DISCOUNT_RULES[state.selections.quantity]?.discount ?? null,
    };
  }, [state.selections]);

  const chooseOption = (optionId) => {
    dispatch({ type: "CHOOSE_OPTION", optionId });
  };

  const sendUserText = (text) => {
    dispatch({ type: "USER_TEXT", text });
  };

  const reset = () => {
    dispatch({ type: "RESET" });
  };

  return {
    state,
    summary,
    chooseOption,
    sendUserText,
    reset,
  };
}
