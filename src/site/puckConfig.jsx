import BlockBoundary from "./BlockBoundary";
import * as blocks from "./blocks";
import SiteFrame from "./SiteFrame";

// The editor's list of blocks: for each one, the settings an owner can change (fields),
// what a new one starts with (defaultProps), and the component that draws it. The same
// components draw the live site (SiteView.jsx), so what is edited is what visitors get.
// The names here are the ones the server allows (BLOCK_TYPES in server/site_content.py).

const ALIGN = {
  type: "radio",
  label: "Line up",
  options: [
    { label: "Left", value: "left" },
    { label: "Center", value: "center" },
  ],
};

const ACTIONS = [
  { label: "The request a quote form", value: "request" },
  { label: "Call us", value: "call" },
  { label: "Email us", value: "email" },
  { label: "Another page of this site", value: "page" },
  { label: "A web address", value: "link" },
];

// The settings for where a button goes. Only the ones its action needs are shown.
function linkFields(pages) {
  return {
    action: { type: "select", label: "When clicked, go to", options: ACTIONS },
    page: {
      type: "select",
      label: "Which page",
      options: pages.map((page) => ({ label: page.title, value: page.slug })),
    },
    href: { type: "text", label: "Web address (starts with https://)" },
  };
}

function withLink(fields, pages) {
  return (data) => {
    const action = data.props?.action || "request";
    const shown = { ...fields };
    if (action !== "page") delete shown.page;
    if (action !== "link") delete shown.href;
    // A button whose page was deleted: say so, where the box would otherwise show the first page.
    const chosen = data.props?.page || "";
    if (shown.page && !pages.some((page) => page.slug === chosen)) {
      shown.page = { ...shown.page, options: [{ label: "A page that is gone: pick another", value: chosen }, ...shown.page.options] };
    }
    return shown;
  };
}

// A block inside its safety net, so one that cannot be drawn does not take the editor
// with it. Made once per block, so the editor sees the same component every time.
const drawn = new Map();
function draw(Block) {
  if (!drawn.has(Block)) {
    drawn.set(Block, function Drawn(props) {
      return (
        <BlockBoundary editing>
          <Block {...props} />
        </BlockBoundary>
      );
    });
  }
  return drawn.get(Block);
}

// pages: the site's pages ({ slug, title }), for "go to another page". current: the address
// of the page being edited, to mark it in the menu.
export function buildConfig({ pages, current }) {
  const link = linkFields(pages);
  const heroFields = {
    title: { type: "text", label: "Headline" },
    text: { type: "textarea", label: "Words under it" },
    buttonLabel: { type: "text", label: "Button words (empty for no button)" },
    ...link,
    align: ALIGN,
    tone: {
      type: "radio",
      label: "Background",
      options: [
        { label: "Your color", value: "brand" },
        { label: "Plain", value: "plain" },
      ],
    },
  };
  const buttonFields = {
    label: { type: "text", label: "Button words" },
    ...link,
    align: ALIGN,
    variant: {
      type: "radio",
      label: "Style",
      options: [
        { label: "Filled", value: "solid" },
        { label: "Outline", value: "outline" },
      ],
    },
  };

  return {
    root: {
      // A page has no settings of its own in the side panel: its name and address are under Page settings.
      fields: {},
      render: ({ children }) => <SiteFrame current={current}>{children}</SiteFrame>,
    },
    categories: {
      top: { title: "Start of a page", components: ["Hero", "Heading"] },
      content: { title: "Words and lists", components: ["Text", "Services", "Features", "Reviews", "Faq"] },
      action: { title: "Getting in touch", components: ["RequestQuote", "Contact", "Button"] },
      layout: { title: "Layout", components: ["Columns", "Spacer", "Divider"] },
    },
    components: {
      Hero: {
        label: "Big headline",
        fields: heroFields,
        resolveFields: withLink(heroFields, pages),
        defaultProps: {
          title: "A headline that says what you do",
          text: "One or two lines about why people should choose you.",
          buttonLabel: "Request a quote",
          action: "request",
          page: "",
          href: "",
          align: "center",
          tone: "brand",
        },
        render: draw(blocks.Hero),
      },
      Heading: {
        label: "Heading",
        fields: {
          text: { type: "text", label: "Heading" },
          level: {
            type: "radio",
            label: "Size",
            options: [
              { label: "Large", value: 2 },
              { label: "Small", value: 3 },
            ],
          },
          align: ALIGN,
        },
        defaultProps: { text: "A heading", level: 2, align: "left" },
        render: draw(blocks.Heading),
      },
      Text: {
        label: "Text",
        fields: {
          text: { type: "textarea", label: "Words (leave an empty line between paragraphs)" },
          align: ALIGN,
          size: {
            type: "radio",
            label: "Size",
            options: [
              { label: "Normal", value: "normal" },
              { label: "Large", value: "large" },
            ],
          },
        },
        defaultProps: { text: "Write something here.", align: "left", size: "normal" },
        render: draw(blocks.Text),
      },
      Services: {
        label: "Services",
        fields: {
          title: { type: "text", label: "Heading" },
          intro: { type: "textarea", label: "Words under the heading" },
          source: {
            type: "radio",
            label: "Which services",
            options: [
              { label: "From my price book", value: "pricebook" },
              { label: "Typed here", value: "custom" },
            ],
          },
          items: {
            type: "array",
            label: "Services typed here",
            arrayFields: {
              name: { type: "text", label: "Service" },
              description: { type: "textarea", label: "About it" },
            },
            defaultItemProps: { name: "A service", description: "" },
            getItemSummary: (item) => item.name || "A service",
          },
          columns: {
            type: "radio",
            label: "Across the page",
            options: [
              { label: "2", value: 2 },
              { label: "3", value: 3 },
            ],
          },
        },
        resolveFields: (data, { fields }) => {
          if (data.props?.source === "custom") return fields;
          const shown = { ...fields };
          delete shown.items;
          return shown;
        },
        defaultProps: { title: "What we do", intro: "", source: "pricebook", items: [], columns: 3 },
        render: draw(blocks.Services),
      },
      Features: {
        label: "Reasons to choose you",
        fields: {
          title: { type: "text", label: "Heading" },
          items: {
            type: "array",
            label: "Reasons",
            arrayFields: {
              title: { type: "text", label: "In a few words" },
              text: { type: "textarea", label: "A line or two more" },
            },
            defaultItemProps: { title: "A reason", text: "" },
            getItemSummary: (item) => item.title || "A reason",
          },
        },
        defaultProps: {
          title: "Why people choose us",
          items: [
            { title: "Local and trusted", text: "We live and work in the community we serve." },
            { title: "Fair, clear prices", text: "You get a written quote before any work starts." },
            { title: "On time", text: "We show up when we say we will." },
          ],
        },
        render: draw(blocks.Features),
      },
      Reviews: {
        label: "Reviews",
        fields: {
          title: { type: "text", label: "Heading" },
          items: {
            type: "array",
            label: "Reviews",
            arrayFields: {
              quote: { type: "textarea", label: "What they said" },
              name: { type: "text", label: "Who said it" },
              place: { type: "text", label: "Where they are (optional)" },
            },
            defaultItemProps: { quote: "They did a great job.", name: "A happy customer", place: "" },
            getItemSummary: (item) => item.name || "A review",
          },
        },
        defaultProps: {
          title: "What customers say",
          items: [{ quote: "They did a great job.", name: "A happy customer", place: "" }],
        },
        render: draw(blocks.Reviews),
      },
      Faq: {
        label: "Questions and answers",
        fields: {
          title: { type: "text", label: "Heading" },
          items: {
            type: "array",
            label: "Questions",
            arrayFields: {
              question: { type: "text", label: "Question" },
              answer: { type: "textarea", label: "Answer" },
            },
            defaultItemProps: { question: "A question people ask", answer: "Your answer." },
            getItemSummary: (item) => item.question || "A question",
          },
        },
        defaultProps: {
          title: "Common questions",
          items: [{ question: "Do you give free quotes?", answer: "Yes. Send a request and we will get back to you." }],
        },
        render: draw(blocks.Faq),
      },
      RequestQuote: {
        label: "Request a quote band",
        fields: {
          title: { type: "text", label: "Headline" },
          text: { type: "textarea", label: "Words under it" },
          buttonLabel: { type: "text", label: "Button words" },
        },
        defaultProps: {
          title: "Ready to get started?",
          text: "Send us a few details and we will be in touch.",
          buttonLabel: "Request a quote",
        },
        render: draw(blocks.RequestQuote),
      },
      Contact: {
        label: "Contact details",
        fields: {
          title: { type: "text", label: "Heading" },
          text: { type: "textarea", label: "Words under the heading" },
          hours: { type: "textarea", label: "Hours" },
          area: { type: "textarea", label: "Where you work" },
        },
        defaultProps: {
          title: "Get in touch",
          text: "Call, email, or send a request and we will get back to you.",
          hours: "Monday to Friday, 8 AM to 5 PM",
          area: "",
        },
        render: draw(blocks.Contact),
      },
      Button: {
        label: "Button",
        fields: buttonFields,
        resolveFields: withLink(buttonFields, pages),
        defaultProps: { label: "Request a quote", action: "request", page: "", href: "", align: "left", variant: "solid" },
        render: draw(blocks.Button),
      },
      Columns: {
        label: "Columns",
        fields: {
          count: {
            type: "radio",
            label: "How many",
            options: [
              { label: "2", value: 2 },
              { label: "3", value: 3 },
            ],
          },
          first: { type: "slot", disallow: ["Columns", "Hero"] },
          second: { type: "slot", disallow: ["Columns", "Hero"] },
          third: { type: "slot", disallow: ["Columns", "Hero"] },
        },
        defaultProps: { count: 2, first: [], second: [], third: [] },
        render: draw(blocks.EditorColumns),
      },
      Spacer: {
        label: "Empty space",
        fields: {
          size: {
            type: "radio",
            label: "How much",
            options: [
              { label: "A little", value: "small" },
              { label: "Some", value: "medium" },
              { label: "A lot", value: "large" },
            ],
          },
        },
        defaultProps: { size: "medium" },
        render: draw(blocks.Spacer),
      },
      Divider: {
        label: "Line across the page",
        fields: {},
        defaultProps: {},
        render: draw(blocks.Divider),
      },
    },
  };
}
