import { useEffect, useState } from "react";
import { Navigate, useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { onAuthStateChanged } from "firebase/auth";
import { RecaptchaHost } from "@/components/auth/RecaptchaHost";
import { MainApp } from "@/pages/MainApp";
import { LoginPage } from "@/pages/LoginPage";
import { auth } from "@/firebase";
import { canAccessApp } from "@/stores/authFlowStore";

export function RecaptchaAndAuthShell({ children }: { children: React.ReactNode }) {
  return (
    <>
      <RecaptchaHost />
      {children}
    </>
  );
}

export function AppRoute() {
  const navigate = useNavigate();
  const [authReady, setAuthReady] = useState(false);
  const [isAuthenticated, setIsAuthenticated] = useState(!!auth.currentUser);

  useEffect(() => {
    return onAuthStateChanged(auth, (user) => {
      setIsAuthenticated(!!user);
      setAuthReady(true);
    });
  }, []);

  if (!authReady) {
    if (canAccessApp(isAuthenticated)) {
      return <MainApp onLogout={() => navigate("/login")} />;
    }

    return (
      <div className="flex min-h-screen items-center justify-center bg-surface">
        <div className="flex gap-2">
          {[0, 1, 2].map((i) => (
            <span
              key={i}
              className="loading-dot h-2.5 w-2.5 rounded-full bg-brand-muted"
              style={{ animationDelay: `${i * 0.2}s` }}
            />
          ))}
        </div>
      </div>
    );
  }

  if (!canAccessApp(isAuthenticated)) {
    return <Navigate to="/login" replace />;
  }

  return <MainApp onLogout={() => navigate("/login")} />;
}

export function LoginRoute() {
  const navigate = useNavigate();
  const [authReady, setAuthReady] = useState(false);
  const [isAuthenticated, setIsAuthenticated] = useState(!!auth.currentUser);

  useEffect(() => {
    return onAuthStateChanged(auth, (user) => {
      setIsAuthenticated(!!user);
      setAuthReady(true);
    });
  }, []);

  if (!authReady) {
    return null;
  }

  if (canAccessApp(isAuthenticated)) {
    return <Navigate to="/app" replace />;
  }

  return (
    <LoginPage
      onSuccess={() => navigate("/app")}
      onNewUser={() => navigate("/quote")}
      onVerifyFailed={(message) => {
        toast.error(message);
        navigate("/login");
      }}
    />
  );
}
