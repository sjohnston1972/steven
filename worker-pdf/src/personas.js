// SYNCED COPY of worker/src/personas.js. Keep in sync. This is a separate
// wrangler project and cannot import across the worker boundary.

// Canonical persona definitions. Imported by index.js, chat.js, render.js.
// Generic = current balanced view (overrides nothing). Each focused persona
// floats its `skill` element up and swaps the hero eyebrow/tagline + about lead.
export const PERSONAS = {
    generic: { id: "generic", label: "Generic", default: true },

    security: {
        id: "security", label: "Security", skill: "security",
        eyebrow: "Network Security Engineer &nbsp;·&nbsp; Glasgow, Scotland",
        tagline: "Securing enterprise networks across on-premise, cloud, and hybrid. Zero Trust, segmentation, and Azure network security.",
        aboutLead: "I design and secure enterprise network infrastructure across on-premise, cloud, and hybrid environments, covering next-generation firewalls, segmentation, Zero Trust access, and Azure network security. I take secure connectivity from first principles through to production for enterprise and public sector clients, including critical national infrastructure.",
        chatbotFocus: "Foreground the Security discipline: cross-vendor firewall migration, next-generation firewall design, rule-base rationalisation, inherited-estate audit, DNS-layer security and IT/OT segmentation. Name the tooling he built for it, Gladius and VIGIL. Frame answers around securing enterprise networks.",
    },

    cloud: {
        id: "cloud", label: "Cloud", skill: "cloud",
        eyebrow: "Cloud Network Architect &nbsp;·&nbsp; Glasgow, Scotland",
        tagline: "Designing secure, resilient Azure networking, including Virtual WAN, ExpressRoute, transit hubs, and hybrid connectivity at enterprise scale.",
        aboutLead: "I design and deliver secure Azure cloud networking for enterprise and public sector clients, covering Virtual WAN, ExpressRoute, transit-hub architectures, NVA firewalls, and resilient hybrid connectivity, taken from design through to production.",
        chatbotFocus: "Foreground the Cloud and hybrid discipline: Azure transit hub and Virtual WAN design, ExpressRoute, NVA and platform firewalls, datacentre exit into Azure, and identity platforms hosted in Azure. Name CloudForge and his Terraform modules.",
    },

    ai: {
        id: "ai", label: "AI", skill: "ai",
        eyebrow: "AI Automation Architect &nbsp;·&nbsp; Glasgow, Scotland",
        tagline: "Bringing agentic AI into infrastructure operations, building automation platforms that cut manual effort and accelerate incident response.",
        aboutLead: "For the past two years I've focused on bringing agentic AI into infrastructure operations, designing and deploying automation platforms that integrate LLM-based tooling with enterprise infrastructure to cut manual effort, speed up delivery, and accelerate incident response.",
        chatbotFocus: "Foreground the Automation and AI discipline, and the link back to delivery work: the tools grew out of doing firewall migration, config templating and API-driven change by hand. Name specific tools, Gladius, Parity, Archie, ShellMate, CloudForge, Webex Migrate, and the human-in-the-loop principle.",
    },

    techlead: {
        id: "techlead", label: "Technical Lead", skill: "techlead",
        eyebrow: "Technical Lead &nbsp;·&nbsp; Glasgow, Scotland",
        tagline: "Leading the architecture and delivery of complex enterprise infrastructure, setting standards and mentoring teams from concept to production.",
        aboutLead: "I lead the technical design and delivery of infrastructure programmes for enterprise and public sector clients, owning architecture, setting technical standards across concurrent programmes, mentoring a team of engineers, and seeing complex multi-vendor deployments through to production.",
        chatbotFocus: "Foreground technical leadership: leading a team of 7 consultants, solution architecture and technical standards across concurrent programmes, design authority over inherited estates, and his signature migration methodology of building alongside, proving before the window and documenting rollback at every step.",
    },

    collaboration: {
        id: "collaboration", label: "Collaboration", skill: "collaboration",
        eyebrow: "Collaboration Architect &nbsp;·&nbsp; Glasgow, Scotland",
        tagline: "Designing enterprise voice and collaboration with Cisco CUCM, Webex, Microsoft Teams, SIP/CUBE, and unified communications at scale.",
        aboutLead: "I design and deliver enterprise collaboration and voice solutions, covering Cisco CUCM and Webex, large-scale Microsoft Teams migrations, SIP and CUBE integration, and secure unified communications for enterprise and public sector clients.",
        chatbotFocus: "Foreground the Collaboration discipline: TDM to SIP migration with number retention, Webex Calling and Microsoft Teams Direct Routing with on-premises coexistence, CUBE session border element engineering, and dial plan design. Name Webex Migrate.",
    },

    datacentre: {
        id: "datacentre", label: "Datacentre", skill: "datacentre",
        eyebrow: "Datacentre Architect &nbsp;·&nbsp; Glasgow, Scotland",
        tagline: "Designing and transforming datacentres with Cisco Nexus and UCS, VMware and Nutanix, and multi-DC builds and migrations.",
        aboutLead: "I design, build, and transform datacentre infrastructure, covering Cisco Nexus switching and UCS compute, VMware and Nutanix, and delivering multi-datacentre builds and migrations for enterprise and public sector clients.",
        chatbotFocus: "Foreground the Datacentre discipline: greenfield colocation builds, end-of-life core replacement, Nexus with vPC and Catalyst with StackWise Virtual, Nutanix and PowerScale and Cohesity platforms, and petabyte-scale storage design.",
    },

    networking: {
        id: "networking", label: "Networking", skill: "networking",
        eyebrow: "Network Architect &nbsp;·&nbsp; Glasgow, Scotland",
        tagline: "Architecting enterprise networks across BGP/OSPF, SD-WAN, campus LAN/WAN, and resilient multi-site connectivity from design to production.",
        aboutLead: "I architect and deliver enterprise networks, covering BGP and OSPF routing, SD-WAN, campus LAN/WAN, and resilient multi-site connectivity, taking complex multi-vendor deployments from design through to production for enterprise and public sector clients.",
        chatbotFocus: "Foreground the Networking discipline: BGP and OSPF and EIGRP, BGP inbound traffic engineering, SD-WAN including greenfield fabrics and cloud-hosted controllers, campus LAN and WAN, and live brownfield cutovers. Name Parity, NetBud and Crucible.",
    },
};

export const DEFAULT_PERSONA = "generic";

export function resolvePersona(id) {
    if (id && Object.prototype.hasOwnProperty.call(PERSONAS, id)) return PERSONAS[id];
    return PERSONAS[DEFAULT_PERSONA];
}
