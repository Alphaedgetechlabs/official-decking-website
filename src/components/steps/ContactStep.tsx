import { useState } from "react";
import { AlertCircle, Clock, ArrowLeft, ArrowRight, User, Mail, Phone, Shield } from "lucide-react";
import { isValidPhoneInput, getPhoneInputError } from "@/utils/phone";

interface ContactStepProps {
  onNext: (data: { name: string; email: string; phone: string }) => void | Promise<void>;
  onBack: () => void;
  submitting?: boolean;
  error?: string | null;
  onClearError?: () => void;
}

const validateEmail = (email: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim());
const validateName = (name: string) => !/\d/.test(name.trim());

const ContactStep = ({ onNext, onBack, submitting = false, error, onClearError }: ContactStepProps) => {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [touched, setTouched] = useState({ name: false, email: false, phone: false });
  const [submitted, setSubmitted] = useState(false);

  const errors = {
    name: !name.trim() ? "Please enter your name" : !validateName(name) ? "Please enter your correct name" : "",
    email: !email.trim() ? "Please enter your email address" : !validateEmail(email) ? "Please enter a valid email address" : "",
    phone: getPhoneInputError(phone),
  };

  const canSubmit = !errors.name && !errors.email && !errors.phone;
  const show = (field: "name" | "email" | "phone") => (touched[field] || submitted) && errors[field];

  const inputClass = (field: "name" | "email" | "phone") =>
    `w-full px-5 py-4 rounded-xl border bg-muted/30 text-foreground placeholder-muted-foreground focus:ring-1 focus:outline-none focus:bg-card ${
      show(field) ? "border-destructive focus:border-destructive focus:ring-destructive" : "border-border focus:border-brand-orange focus:ring-brand-orange"
    }`;

  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-muted">
      <main className="w-full max-w-[600px] bg-card rounded-2xl shadow-sm border border-border p-8 md:p-12">
        {/* Progress */}
        <section className="mb-10">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center text-muted-foreground text-sm font-medium">
              <Clock className="w-4 h-4 mr-2" />
              Step 4 of 5
            </div>
            <span className="text-brand-orange text-sm font-semibold">80% Complete</span>
          </div>
          <div className="w-full h-2 bg-brand-orange-light rounded-full overflow-hidden">
            <div className="h-full bg-brand-orange rounded-full" style={{ width: "80%" }}></div>
          </div>
        </section>

        {/* Heading */}
        <header className="mb-8">
          <h1 className="text-[32px] md:text-[36px] font-bold text-foreground leading-tight mb-4">
            Almost done! Your quotes are just minutes away.
          </h1>
          <p className="text-muted-foreground text-lg">
            Enter your details so your decking pros can send accurate pricing.
          </p>
        </header>

        {/* Form */}
        <form
          onSubmit={async (e) => {
            e.preventDefault();
            setSubmitted(true);
            if (canSubmit) await onNext({ name, email, phone });
          }}
          className="space-y-6"
          noValidate
        >
          <div className="space-y-2">
            <label className="flex items-center text-foreground font-semibold text-sm" htmlFor="full-name">
              <User className="w-4 h-4 mr-2" />
              Full Name
            </label>
            <input
              className={inputClass("name")}
              id="full-name"
              placeholder="John Smith"
              type="text"
              value={name}
              onChange={(e) => {
                setName(e.target.value);
                onClearError?.();
              }}
              onBlur={() => setTouched((t) => ({ ...t, name: true }))}
            />
            {show("name") && <p className="text-destructive text-sm mt-1">{errors.name}</p>}
          </div>

          <div className="space-y-2">
            <label className="flex items-center text-foreground font-semibold text-sm" htmlFor="email">
              <Mail className="w-4 h-4 mr-2" />
              Email Address
            </label>
            <input
              className={inputClass("email")}
              id="email"
              placeholder="john@example.com"
              type="email"
              value={email}
              onChange={(e) => {
                setEmail(e.target.value);
                onClearError?.();
              }}
              onBlur={() => setTouched((t) => ({ ...t, email: true }))}
            />
            {show("email") && <p className="text-destructive text-sm mt-1">{errors.email}</p>}
          </div>

          <div className="space-y-2">
            <label className="flex items-center text-foreground font-semibold text-sm" htmlFor="phone">
              <Phone className="w-4 h-4 mr-2" />
              Best Phone Number
            </label>
            <input
              className={inputClass("phone")}
              id="phone"
              type="tel"
              inputMode="tel"
              autoComplete="tel"
              value={phone}
              onChange={(e) => {
                setPhone(e.target.value);
                onClearError?.();
              }}
              onBlur={() => setTouched((t) => ({ ...t, phone: true }))}
              placeholder="03XX XXXXXXX, +92 3XX…, 04XX XXX XXX, or +61…"
            />
            {show("phone") && <p className="text-destructive text-sm mt-1">{errors.phone}</p>}
          </div>

          {/* Trust */}
          <div className="space-y-3 pt-4">
            {["Zero spam — ever", "Your details are private and secure"].map((text) => (
              <div key={text} className="flex items-center text-sm text-muted-foreground">
                <Shield className="w-4 h-4 text-brand-orange mr-2" />
                {text}
              </div>
            ))}
          </div>

          {/* Nav */}
          {error && (
            <div
              role="alert"
              className="flex gap-3 rounded-xl border border-red-200 bg-red-50 p-4"
            >
              <AlertCircle className="mt-0.5 h-5 w-5 shrink-0 text-red-500" />
              <div>
                <p className="text-sm font-semibold text-red-800">Could not send verification code</p>
                <p className="mt-1 text-xs leading-relaxed text-red-600">{error}</p>
              </div>
            </div>
          )}

          <div className="flex flex-col sm:flex-row gap-4 pt-4">
            <button
              type="button"
              onClick={onBack}
              className="flex-1 flex items-center justify-center px-6 py-4 bg-muted text-foreground font-bold rounded-xl transition-colors hover:bg-secondary"
            >
              <ArrowLeft className="w-5 h-5 mr-2" />
              Back
            </button>
            <button
              type="submit"
              disabled={submitting || !canSubmit}
              className="flex-[1.5] flex items-center justify-center px-6 py-4 bg-brand-orange text-primary-foreground font-bold rounded-xl transition-opacity hover:opacity-90 disabled:opacity-50 shadow-md"
            >
              {submitting ? "Sending code..." : "Get My Free Quotes"}
              <ArrowRight className="w-5 h-5 ml-2" />
            </button>
          </div>
        </form>
      </main>
    </div>
  );
};

export default ContactStep;
