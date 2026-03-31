import React from 'react';

export default class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, info) {
    console.error('ErrorBoundary caught:', error, info?.componentStack);
  }

  render() {
    if (this.state.hasError) {
      // Compact mode for widget-level boundaries
      if (this.props.compact) {
        return (
          <div className="rounded-xl border border-red-200 dark:border-red-500/20 bg-red-50 dark:bg-red-500/10 p-6 text-center" dir="rtl">
            <p className="text-sm text-red-600 dark:text-red-400 mb-3">حدث خطأ في تحميل هذا القسم</p>
            <button
              className="px-4 py-1.5 text-xs bg-[#c9a84c] text-white rounded-lg hover:bg-[#b8973f]"
              onClick={() => this.setState({ hasError: false, error: null })}
            >
              إعادة المحاولة
            </button>
          </div>
        );
      }

      return (
        <div className="flex items-center justify-center min-h-screen text-center p-8 bg-white dark:bg-[#0f0f1a]" dir="rtl">
          <div>
            <h1 className="text-2xl font-bold text-red-600 dark:text-red-400 mb-4">حدث خطأ غير متوقع</h1>
            <p className="text-gray-600 dark:text-gray-400 mb-4">نعتذر عن هذا الخطأ. يرجى تحديث الصفحة والمحاولة مرة أخرى.</p>
            <button
              className="px-6 py-2 bg-[#c9a84c] text-white rounded-lg hover:bg-[#b8973f]"
              onClick={() => window.location.reload()}
            >
              تحديث الصفحة
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}
