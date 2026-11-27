import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Link, Outlet, RouterProvider, createBrowserRouter } from "react-router";
import { Toaster } from "sonner";
import { PageHeader } from "./components/PageHeader";
import { TopBar } from "./components/TopBar";
import { DashboardPage } from "./features/dashboard/DashboardPage";
import { ContactPage } from "./features/contacts/ContactPage";
import { ContactsPage } from "./features/contacts/ContactsPage";
import { DealPage } from "./features/deals/DealPage";
import { DealsPage } from "./features/deals/DealsPage";
import { OrganizationPage } from "./features/organizations/OrganizationPage";
import { OrganizationsPage } from "./features/organizations/OrganizationsPage";
import { PipelinePage } from "./features/pipeline/PipelinePage";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: { staleTime: 10_000, refetchOnWindowFocus: false },
  },
});

function Layout() {
  return (
    <>
      <TopBar />
      <main className="main">
        <Outlet />
      </main>
    </>
  );
}

function NotFound() {
  return (
    <>
      <PageHeader title="Page not found" />
      <p>
        There's no page at this address. <Link to="/">Go to the dashboard</Link>
      </p>
    </>
  );
}

const router = createBrowserRouter([
  {
    element: <Layout />,
    children: [
      { path: "/", element: <DashboardPage /> },
      { path: "/organizations", element: <OrganizationsPage /> },
      { path: "/organizations/:id", element: <OrganizationPage /> },
      { path: "/contacts", element: <ContactsPage /> },
      { path: "/contacts/:id", element: <ContactPage /> },
      { path: "/deals", element: <DealsPage /> },
      { path: "/deals/:id", element: <DealPage /> },
      { path: "/pipeline", element: <PipelinePage /> },
      { path: "*", element: <NotFound /> },
    ],
  },
]);

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <RouterProvider router={router} />
      <Toaster position="bottom-right" toastOptions={{ className: "toast" }} />
    </QueryClientProvider>
  );
}
