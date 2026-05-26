import { FileUp, Bot, Search, ShieldCheck, CalendarClock, Languages, Zap, GitCompareArrows, LayoutGrid, History, ScanSearch } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from './ui/accordion';
import { Button } from './ui/button';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { ScrollAnimation } from './ui/scroll-animation';

type FaqProps = {
    onStartSession: () => void;
};

const features = [
    {
      icon: <Zap className="h-8 w-8 text-primary" />,
      title: "Plain Language Explanation",
      description: "Cut through government document jargon to understand eligibility criteria, benefits, and requirements clearly."
    },
    {
      icon: <ShieldCheck className="h-8 w-8 text-primary" />,
      title: "Requirement Detection",
      description: "Our AI identifies all key requirements and eligibility conditions so you know exactly what you need to qualify."
    },
    {
      icon: <CalendarClock className="h-8 w-8 text-primary" />,
      title: "Deadline Tracker",
      description: "Never miss important application deadlines. Vidhik extracts all key dates and action items into a clear checklist."
    },
    {
        icon: <ScanSearch className="h-8 w-8 text-primary" />,
        title: "OCR & PII Masking",
        description: "Government documents often exist as scanned copies. Upload an image, and our AI will extract the text and mask personal information for your privacy."
    },
    {
      icon: <Languages className="h-8 w-8 text-primary" />,
      title: "Vernacular Language Support",
      description: "Upload documents in regional Indian languages and get clarity in the language you're most comfortable with."
    },
    {
      icon: <GitCompareArrows className="h-8 w-8 text-primary" />,
      title: "Compare Scheme Versions",
      description: "Upload two versions of a scheme document to see exactly what has changed in eligibility, benefits, or requirements."
    },
    {
      icon: <History className="h-8 w-8 text-primary" />,
      title: "Session History",
      description: "Automatically saves your past analysis and comparison sessions so you can revisit them at any time."
    },
    {
      icon: <LayoutGrid className="h-8 w-8 text-primary" />,
      title: "My Documents",
      description: "A central gallery of all your uploaded government documents for quick access and starting new analysis sessions."
    }
  ];

  const faqItems = [
    {
        question: "What is Vidhik AI?",
        answer: "Vidhik AI is NOT a legal document analyzer. It is a Government Document Analyzer specialized in helping you understand government poverty relief scheme documents issued by Indian government or state governments. You can upload a document, and our AI will provide a simple summary, explain confusing terminology, identify key eligibility requirements and deadlines, flag important conditions, and answer specific questions you have about the scheme."
    },
    {
        question: "What types of government poverty relief documents can I analyze?",
        answer: `Vidhik AI specializes in analyzing documents from various government poverty relief schemes, including but not limited to:

*   **Income Support & Cash Transfer Schemes**: Public Distribution System (PDS), Direct Benefit Transfer (DBT) schemes
*   **Employment Schemes**: MGNREGA, Skill India, Start-up India documents
*   **Health & Social Security**: Ayushman Bharat, PM-JAY scheme documents
*   **Housing & Infrastructure**: PM Awas Yojana, PMAY-G documents
*   **Education & Scholarship Schemes**: Various scholarship program documents and eligibility criteria
*   **Agricultural & Rural Schemes**: Pradhan Mantri Krishi Sinchayee Yojana, PM-KISAN documents
*   **Women & Child Welfare**: Sukanya Samriddhi Yojana, ICDS scheme documents
*   **Other Government Social Schemes**: Any official government or state government poverty relief initiative documentation`
    },
    {
        question: "What are the main features?",
        answer: `Vidhik AI offers several powerful features designed specifically for government poverty relief scheme documents:

*   **AI Document Analyzer**: Upload a document, paste its text, or even use a scanned image. Our OCR technology can extract text from images of government documents. For your privacy, the AI automatically detects and masks Personally Identifiable Information (PII). You get a complete breakdown including a summary of the scheme, eligibility requirements, a list of key terms explained, important deadlines and action items, and a detailed analysis of conditions and requirements. You can then chat with the AI to ask specific questions.
*   **Compare Scheme Versions**: Upload two different versions of a scheme document to see exactly what has changed. The AI will highlight new eligibility criteria, modified benefit amounts, changed requirements, and anything that has been removed.
*   **Session History**: Your analysis and comparison sessions are automatically saved. You can easily browse and reload past results from the history panel.
*   **My Documents**: A central place to view all the government documents you've analyzed. You can quickly select a past document to start a new analysis.`
    },
    {
        question: "How does the AI Document Analyzer work?",
        answer: `When you upload a government poverty relief scheme document, our AI reads and analyzes the entire text to extract key information. It then generates a structured report with several sections:

*   **Scheme Summary**: A high-level overview of the scheme's purpose and main benefits.
*   **Eligibility & Requirements**: Clear identification of who qualifies, income limits, age criteria, and other key requirements.
*   **Key Terms Explained**: A list of government and scheme-specific terminology with simple, easy-to-understand definitions.
*   **Deadlines & Action Items**: Extracts application deadlines, submission dates, and required actions into a clear checklist.
*   **Important Conditions**: Highlights key conditions, restrictions, and obligations you need to be aware of.

After this initial analysis, you can download the original document for your records. The chat window also becomes active, allowing you to ask follow-up questions about any part of the scheme document.`
    },
    {
        question: "Can I compare two versions of a poverty relief scheme?",
        answer: `Yes! Upload an "original" version of a scheme document (Document A) and a "revised" version (Document B). The AI performs a detailed comparison and generates a report with three main sections:

*   **New Provisions**: New eligibility criteria, benefits, or requirements present in the revised version but not in the original.
*   **Changed Terms**: Provisions that exist in both versions but have been modified—you'll see the old and new details side-by-side.
*   **Removed Provisions**: Provisions that were in the original version but have been removed from the revised version.

This is ideal when comparing old and new scheme guidelines or when a scheme has been updated.`
    },
    {
        question: "What file formats can I upload?",
        answer: "You can upload common file types like .txt, .pdf, and .docx, as well as image files like .png and .jpg for scanned or photographed government documents. You can also paste text directly into the application. The AI can understand documents in both English and major Indian regional languages."
    },
    {
        question: "Is Vidhik AI a replacement for official government guidance?",
        answer: "No. Vidhik AI is a tool to help you understand government poverty relief scheme documents more easily. It is NOT a substitute for official government guidance, legal advice, or government support services. Always verify important information with official government sources or government officials. For accurate and binding information about any scheme, please consult the official government website or visit your nearest government office."
    },
    {
        question: "Is my data secure and private?",
        answer: "Yes. We prioritize your privacy and data security. Your documents and session history are tied to your user account and stored securely in an encrypted database. They are not shared with any third party and are not used for any purpose other than improving your experience with Vidhik AI."
    }
]


export default function Faq({ onStartSession }: FaqProps) {
  return (
    <div className="space-y-16 py-8">
      {/* Hero Section */}
      <ScrollAnimation>
        <section className="text-center">
            <h1 className="font-headline text-4xl md:text-5xl font-bold tracking-tight">
            Understand Government Poverty Relief Schemes in Minutes.
            </h1>
            <p className="mt-4 max-w-2xl mx-auto text-lg text-muted-foreground">
            Government poverty relief scheme documents can be confusing. Vidhik uses the power of AI to break down complicated government documents into simple, clear language you can understand. Discover your eligibility, understand deadlines, and never miss important requirements. Your guide to government schemes is here.
            </p>
            <div className="mt-8">
                <Button size="lg" onClick={onStartSession}>Try Vidhik Now</Button>
            </div>
        </section>
      </ScrollAnimation>

      {/* How It Works Section */}
      <ScrollAnimation>
      <section>
        <div className="text-center">
            <h2 className="font-headline text-3xl font-bold">Understand Schemes in Three Simple Steps</h2>
        </div>
        <div className="mt-12 grid gap-8 md:grid-cols-3">
            <ScrollAnimation delay={0.1}>
            <div className="text-center flex flex-col items-center">
                <div className="flex items-center justify-center h-16 w-16 rounded-full bg-primary/10 text-primary">
                    <FileUp className="h-8 w-8" />
                </div>
                <h3 className="mt-4 text-xl font-semibold">1. Upload Scheme Document</h3>
                <p className="mt-2 text-muted-foreground">
                    Securely upload any government poverty relief scheme document—eligibility guidelines, scheme handbooks, notification documents, or application forms. Our platform is safe, private, and confidential.
                </p>
            </div>
            </ScrollAnimation>
            <ScrollAnimation delay={0.2}>
            <div className="text-center flex flex-col items-center">
                <div className="flex items-center justify-center h-16 w-16 rounded-full bg-primary/10 text-primary">
                    <Bot className="h-8 w-8" />
                </div>
                <h3 className="mt-4 text-xl font-semibold">2. AI Analysis</h3>
                <p className="mt-2 text-muted-foreground">
                    Vidhik's AI instantly analyzes the scheme document, identifying eligibility requirements, key deadlines, important conditions, and benefits in simple, clear language.
                </p>
            </div>
            </ScrollAnimation>
            <ScrollAnimation delay={0.3}>
            <div className="text-center flex flex-col items-center">
                <div className="flex items-center justify-center h-16 w-16 rounded-full bg-primary/10 text-primary">
                    <Search className="h-8 w-8" />
                </div>
                <h3 className="mt-4 text-xl font-semibold">3. Ask Your Questions</h3>
                <p className="mt-2 text-muted-foreground">
                    Use our chat interface to ask specific questions about the scheme in plain English or your regional language. Get instant answers and understand your eligibility with confidence.
                </p>
            </div>
            </ScrollAnimation>
        </div>
      </section>
      </ScrollAnimation>
      
      {/* Features Section */}
      <ScrollAnimation>
      <section>
        <div className="text-center">
            <h2 className="font-headline text-3xl font-bold">Powerful Tools for Understanding Schemes</h2>
        </div>
        <div className="mt-12 grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
            {features.map((feature, index) => (
            <ScrollAnimation key={feature.title} delay={index * 0.1}>
            <Card className="bg-secondary/50 h-full">
                <CardHeader>
                    {feature.icon}
                </CardHeader>
                <CardContent>
                    <h3 className="font-semibold text-lg">{feature.title}</h3>
                    <p className="mt-2 text-muted-foreground">{feature.description}</p>
                </CardContent>
            </Card>
            </ScrollAnimation>
            ))}
        </div>
      </section>
      </ScrollAnimation>

      {/* FAQ Section */}
      <ScrollAnimation>
      <section>
        <div className="text-center">
          <h2 className="font-headline text-3xl font-bold">Frequently Asked Questions</h2>
        </div>
        <div className="mt-12 max-w-3xl mx-auto">
            <Accordion type="single" collapsible className="w-full">
                {faqItems.map((item, index) => (
                     <AccordionItem value={`item-${index}`} key={index}>
                        <AccordionTrigger>{item.question}</AccordionTrigger>
                        <AccordionContent>
                            <ReactMarkdown className="prose prose-sm dark:prose-invert max-w-none">
                                {item.answer}
                            </ReactMarkdown>
                        </AccordionContent>
                    </AccordionItem>
                ))}
            </Accordion>
        </div>
      </section>
      </ScrollAnimation>

      {/* Final CTA Section */}
      <ScrollAnimation>
      <section className="text-center bg-secondary py-12 rounded-lg">
        <h2 className="font-headline text-3xl font-bold">
            Make Informed Decisions About Government Schemes.
        </h2>
        <p className="mt-3 max-w-xl mx-auto text-muted-foreground">
            Don't miss out on benefits you're eligible for. Understand scheme requirements, deadlines, and eligibility criteria with Vidhik.
        </p>
        <div className="mt-8">
            <Button size="lg" onClick={onStartSession}>Get Started</Button>
        </div>
      </section>
      </ScrollAnimation>
    </div>
  )
}
